import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { VerificationBadge } from "@/components/StatusBadge";
import { setVerification } from "./actions";
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

  const [pendingRes, listRes] = await Promise.all([
    db
      .from("professionals")
      .select(select)
      .eq("verification_status", "pending")
      .order("created_at", { ascending: true }),
    listQuery,
  ]);

  const pending = (pendingRes.data ?? []) as unknown as ProRow[];
  const pros = (listRes.data ?? []) as unknown as ProRow[];

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
                </tr>
              </thead>
              <tbody>
                {pros.map((p) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
