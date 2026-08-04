import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, shortId } from "@/lib/format";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ReviewStatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteReview, setReviewStatus } from "./actions";
import type { ReviewStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS: { key: string; label: string; status: ReviewStatus | null }[] = [
  { key: "all", label: S.tabAll, status: null },
  { key: "published", label: S.tabPublished, status: "published" },
  { key: "hidden", label: S.tabHidden, status: "hidden" },
];

type ReviewRow = {
  id: string;
  rating: number;
  status: ReviewStatus;
  created_at: string;
  booking_id: string;
  customer: { full_name: string } | null;
  professional: { business_name: string } | null;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="whitespace-nowrap text-amber-500" title={`${rating}/5`}>
      {"★".repeat(rating)}
      <span className="text-stone-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const activeTab = TABS.find((t) => t.key === status) ?? TABS[0];

  const db = createAdminClient();
  let query = db
    .from("reviews")
    .select(
      `id, rating, status, created_at, booking_id,
       customer:profiles!reviews_customer_id_fkey(full_name),
       professional:professionals!reviews_professional_id_fkey(business_name)`,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (activeTab.status) query = query.eq("status", activeTab.status);

  const { data } = await query;
  const reviews = (data ?? []) as unknown as ReviewRow[];

  return (
    <div>
      <PageHeader title={S.reviewsTitle} subtitle={`${reviews.length} ${S.results}`} />

      {/* Aggregates (rating_avg / rating_count) are maintained by the
          review_effects DB trigger — never recomputed in app code. */}
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-5 text-amber-800">
        ⚠️ {S.reviewsNote}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/reviews" : `/reviews?status=${t.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              activeTab.key === t.key
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-[#ece5dd] bg-white text-[#57493e] hover:bg-brand-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        {reviews.length === 0 ? (
          <EmptyState icon="⭐" title={S.reviewsEmpty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{S.colProfessional}</th>
                  <th>{S.colCustomer}</th>
                  <th>{S.colStars}</th>
                  <th>{S.colStatus}</th>
                  <th>{S.colBooking}</th>
                  <th>{S.colDate}</th>
                  <th>{S.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className={r.status === "hidden" ? "opacity-70" : ""}>
                    <td className="font-semibold">
                      {r.professional?.business_name || S.none}
                    </td>
                    <td>{r.customer?.full_name || S.none}</td>
                    <td>
                      <Stars rating={r.rating} />
                    </td>
                    <td>
                      <ReviewStatusBadge status={r.status} />
                    </td>
                    <td>
                      <Link
                        href={`/bookings/${r.booking_id}`}
                        className="font-mono text-xs font-semibold text-brand-600 hover:underline"
                        dir="ltr"
                      >
                        {shortId(r.booking_id)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-xs text-[#8a7a6d]">
                      {formatDateTime(r.created_at)}
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <form action={setReviewStatus}>
                          <input type="hidden" name="reviewId" value={r.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={r.status === "hidden" ? "published" : "hidden"}
                          />
                          <SubmitButton
                            label={r.status === "hidden" ? S.reviewPublish : S.reviewHide}
                            className="btn-outline !px-3 !py-1.5 text-xs"
                          />
                        </form>
                        <form action={deleteReview}>
                          <input type="hidden" name="reviewId" value={r.id} />
                          <SubmitButton
                            label={S.delete}
                            className="btn-danger !px-3 !py-1.5 text-xs"
                          />
                        </form>
                      </div>
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
