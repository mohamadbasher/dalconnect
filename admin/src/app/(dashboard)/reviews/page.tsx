import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, shortId } from "@/lib/format";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { deleteReview } from "./actions";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  rating: number;
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

export default async function ReviewsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db
    .from("reviews")
    .select(
      `id, rating, created_at, booking_id,
       customer:profiles!reviews_customer_id_fkey(full_name),
       professional:professionals!reviews_professional_id_fkey(business_name)`,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const reviews = (data ?? []) as unknown as ReviewRow[];

  return (
    <div>
      <PageHeader title={S.reviewsTitle} subtitle={`${reviews.length} ${S.results}`} />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
        ⚠️ {S.reviewsNote}
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
                  <th>{S.colBooking}</th>
                  <th>{S.colDate}</th>
                  <th>{S.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">
                      {r.professional?.business_name || S.none}
                    </td>
                    <td>{r.customer?.full_name || S.none}</td>
                    <td>
                      <Stars rating={r.rating} />
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
                      <form action={deleteReview}>
                        <input type="hidden" name="reviewId" value={r.id} />
                        <button type="submit" className="btn-danger !px-3 !py-1.5 text-xs">
                          {S.delete}
                        </button>
                      </form>
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
