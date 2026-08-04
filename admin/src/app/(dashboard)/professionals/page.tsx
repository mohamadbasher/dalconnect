import { S, fmt } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { daysUntil, formatDate, formatDateTimeFull } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { FeaturedBadge, VerificationBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { moveFeatured, setFeatured, setVerification } from "./actions";
import type { FeaturedState } from "@/components/StatusBadge";
import type { VerificationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProRow = {
  id: string;
  business_name: string;
  is_available: boolean;
  verification_status: VerificationStatus;
  id_document_url: string | null;
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  created_at: string;
  featured: boolean;
  featured_until: string | null;
  featured_sort: number;
  profile: { full_name: string; phone: string } | null;
  city: { name_ar: string } | null;
  categories: { category: { name_ar: string } | null }[];
};

/** id_document_url is stored as a bucket path; tolerate full URLs too. */
function documentPath(raw: string): string {
  if (!raw.startsWith("http")) return raw;
  const marker = "/id-documents/";
  const idx = raw.indexOf(marker);
  return idx >= 0 ? decodeURIComponent(raw.slice(idx + marker.length)) : raw;
}

/**
 * Mirrors the DB's is_featured_now(): a pro only counts as promoted while
 * `featured` is set AND the window is still open.
 */
function featuredState(p: Pick<ProRow, "featured" | "featured_until">): FeaturedState {
  if (!p.featured) return "off";
  if (!p.featured_until) return "active";
  return new Date(p.featured_until).getTime() > Date.now() ? "active" : "expired";
}

const FEATURED_GRID =
  "grid grid-cols-[34px_1fr_190px_150px_auto] items-center gap-3 px-2 py-2.5";

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const db = createAdminClient();

  const select = `id, business_name, is_available, verification_status, id_document_url,
    rating_avg, rating_count, jobs_completed, created_at,
    featured, featured_until, featured_sort,
    profile:profiles!professionals_id_fkey(full_name, phone),
    city:cities(name_ar),
    categories:professional_categories(category:categories(name_ar))`;

  let listQuery = db
    .from("professionals")
    .select(select)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q?.trim()) {
    const term = q.trim().replaceAll(",", " ");
    listQuery = listQuery.ilike("business_name", `%${term}%`);
  }

  const [pendingRes, featuredRes, listRes] = await Promise.all([
    db
      .from("professionals")
      .select(select)
      .eq("verification_status", "pending")
      .order("created_at", { ascending: true }),
    db
      .from("professionals")
      .select(select)
      .eq("featured", true)
      .order("featured_sort", { ascending: true })
      .order("id", { ascending: true }),
    listQuery,
  ]);

  const pending = (pendingRes.data ?? []) as unknown as ProRow[];
  const featured = (featuredRes.data ?? []) as unknown as ProRow[];
  const pros = (listRes.data ?? []) as unknown as ProRow[];

  const activeFeatured = featured.filter((p) => featuredState(p) === "active").length;

  // Signed URLs for pending ID documents (private bucket, 1 hour)
  const signedUrls = new Map<string, string>();
  await Promise.all(
    pending
      .filter((p) => p.id_document_url)
      .map(async (p) => {
        const { data } = await db.storage
          .from("id-documents")
          .createSignedUrl(documentPath(p.id_document_url!), 3600);
        if (data?.signedUrl) signedUrls.set(p.id, data.signedUrl);
      }),
  );

  return (
    <div>
      <PageHeader title={S.prosTitle} subtitle={`${pros.length} ${S.results}`}>
        <SearchInput placeholder={S.searchPros} />
      </PageHeader>

      {/* Pending verifications */}
      <section className="mb-6">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-amber-500" />
          {S.pendingVerifications}
          {pending.length > 0 && (
            <span className="badge border border-amber-200 bg-amber-50 text-amber-700">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length === 0 ? (
          <div className="card">
            <EmptyState icon="🪪" title={S.noPending} />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{p.business_name || S.none}</div>
                    <div className="text-xs text-[#8a7a6d]">
                      {p.profile?.full_name || S.none}
                      {p.profile?.phone ? (
                        <span dir="ltr"> · {p.profile.phone}</span>
                      ) : null}
                    </div>
                  </div>
                  <VerificationBadge status={p.verification_status} />
                </div>
                <div className="mb-3 text-xs text-[#8a7a6d]">
                  {p.city?.name_ar || S.none} · {formatDate(p.created_at)}
                </div>
                <div className="mb-3">
                  {signedUrls.has(p.id) ? (
                    <a
                      href={signedUrls.get(p.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline w-full"
                    >
                      🪪 {S.viewIdDocument}
                    </a>
                  ) : (
                    <div className="rounded-lg bg-[#faf7f4] px-3 py-2 text-center text-xs text-[#8a7a6d]">
                      {S.noIdDocument}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <form action={setVerification} className="flex-1">
                    <input type="hidden" name="proId" value={p.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button type="submit" className="btn-success w-full">
                      ✓ {S.approve}
                    </button>
                  </form>
                  <form action={setVerification} className="flex-1">
                    <input type="hidden" name="proId" value={p.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button type="submit" className="btn-danger w-full">
                      ✗ {S.reject}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Promoted (featured) professionals */}
      <section className="mb-6">
        <h2 className="section-title mb-1 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-amber-400" />
          ★ {S.featuredTitle}
          {activeFeatured > 0 && (
            <span className="badge border border-amber-300 bg-amber-50 text-amber-700">
              {activeFeatured}
            </span>
          )}
        </h2>
        <p className="mb-3 text-xs text-[#8a7a6d]">{S.featuredNote}</p>

        <div className="card overflow-x-auto">
          {featured.length === 0 ? (
            <EmptyState icon="★" title={S.featuredEmpty} />
          ) : (
            <div className="min-w-[760px] p-3">
              {featured.map((p, i) => {
                const state = featuredState(p);
                const left = daysUntil(p.featured_until);
                return (
                  <div
                    key={p.id}
                    className={`${FEATURED_GRID} border-b border-[#f3eee8] last:border-b-0 ${
                      state === "expired" ? "bg-red-50/40" : ""
                    }`}
                  >
                    <div className="text-center text-sm font-bold text-[#8a7a6d]">{i + 1}</div>

                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {p.business_name || S.none}
                      </div>
                      <div className="truncate text-xs text-[#8a7a6d]">
                        {p.profile?.full_name || S.none}
                        {p.city?.name_ar ? ` · ${p.city.name_ar}` : ""}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <FeaturedBadge state={state} />
                      <div className="text-[11px] text-[#8a7a6d]">
                        {!p.featured_until
                          ? S.featuredNoExpiry
                          : state === "active"
                            ? fmt(S.featuredRemaining, { n: left })
                            : `${S.featuredUntil} ${formatDateTimeFull(p.featured_until)}`}
                      </div>
                      {state === "expired" && (
                        <div className="text-[11px] font-medium text-red-700">
                          {S.featuredExpiredHint}
                        </div>
                      )}
                    </div>

                    {/* Reorder — one action renormalises the whole set */}
                    <div className="flex gap-1.5">
                      <form action={moveFeatured}>
                        <input type="hidden" name="proId" value={p.id} />
                        <input type="hidden" name="dir" value="up" />
                        <button
                          type="submit"
                          disabled={i === 0}
                          title={S.featuredMoveUp}
                          className="btn-outline !px-2.5 !py-1 text-xs disabled:opacity-40"
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveFeatured}>
                        <input type="hidden" name="proId" value={p.id} />
                        <input type="hidden" name="dir" value="down" />
                        <button
                          type="submit"
                          disabled={i === featured.length - 1}
                          title={S.featuredMoveDown}
                          className="btn-outline !px-2.5 !py-1 text-xs disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </form>
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      <form action={setFeatured} className="flex items-center gap-1.5">
                        <input type="hidden" name="proId" value={p.id} />
                        <input type="hidden" name="featured" value="true" />
                        <input
                          name="days"
                          type="number"
                          min={1}
                          max={365}
                          placeholder={S.featuredDays}
                          title={S.featuredDaysHint}
                          className="input !w-24 !py-1 text-xs"
                          dir="ltr"
                        />
                        <SubmitButton
                          label={S.featuredExtend}
                          className="btn-primary !px-3 !py-1.5 text-xs"
                        />
                      </form>
                      <form action={setFeatured}>
                        <input type="hidden" name="proId" value={p.id} />
                        <input type="hidden" name="featured" value="false" />
                        <SubmitButton
                          label={S.featuredStop}
                          className="btn-danger !px-3 !py-1.5 text-xs"
                        />
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* All professionals */}
      <div className="card overflow-hidden">
        {pros.length === 0 ? (
          <EmptyState icon="🛠️" title={S.prosEmpty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{S.colBusinessName}</th>
                  <th>{S.colOwner}</th>
                  <th>{S.colPhone}</th>
                  <th>{S.colCategories}</th>
                  <th>{S.colCity}</th>
                  <th>{S.colRating}</th>
                  <th>{S.colJobs}</th>
                  <th>{S.colVerification}</th>
                  <th>{S.colAvailable}</th>
                  <th>{S.colFeatured}</th>
                </tr>
              </thead>
              <tbody>
                {pros.map((p) => {
                  const state = featuredState(p);
                  return (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.business_name || S.none}</td>
                      <td>{p.profile?.full_name || S.none}</td>
                      <td dir="ltr" className="text-end font-mono text-xs">
                        {p.profile?.phone || S.none}
                      </td>
                      <td className="max-w-[220px]">
                        <span className="text-xs">
                          {p.categories
                            .map((c) => c.category?.name_ar)
                            .filter(Boolean)
                            .join("، ") || S.none}
                        </span>
                      </td>
                      <td>{p.city?.name_ar || S.none}</td>
                      <td className="whitespace-nowrap">
                        <span className="text-amber-500">★</span>{" "}
                        {Number(p.rating_avg).toFixed(1)}
                        <span className="text-xs text-[#8a7a6d]"> ({p.rating_count})</span>
                      </td>
                      <td>{p.jobs_completed}</td>
                      <td>
                        <VerificationBadge status={p.verification_status} />
                      </td>
                      <td>
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            p.is_available ? "bg-green-500" : "bg-stone-300"
                          }`}
                          title={p.is_available ? S.yes : S.no}
                        />
                      </td>
                      <td>
                        {p.featured ? (
                          <div className="flex items-center gap-1.5">
                            <FeaturedBadge state={state} />
                            <form action={setFeatured}>
                              <input type="hidden" name="proId" value={p.id} />
                              <input type="hidden" name="featured" value="false" />
                              <SubmitButton
                                label={S.featuredStop}
                                className="btn-outline !px-2 !py-1 text-xs"
                              />
                            </form>
                          </div>
                        ) : (
                          <form action={setFeatured} className="flex items-center gap-1.5">
                            <input type="hidden" name="proId" value={p.id} />
                            <input type="hidden" name="featured" value="true" />
                            <input
                              name="days"
                              type="number"
                              min={1}
                              max={365}
                              placeholder="30"
                              title={S.featuredDaysHint}
                              className="input !w-16 !py-1 text-xs"
                              dir="ltr"
                            />
                            <SubmitButton
                              label={S.featuredPromote}
                              className="btn-primary !px-2 !py-1 text-xs"
                            />
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
