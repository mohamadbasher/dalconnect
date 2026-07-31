import Link from "next/link";
import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, formatPrice, shortId } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { BookingStatusBadge } from "@/components/StatusBadge";
import type { BookingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS: { key: string; label: string; statuses: BookingStatus[] | null }[] = [
  { key: "all", label: S.tabAll, statuses: null },
  { key: "open", label: S.tabOpen, statuses: ["open", "pending"] },
  { key: "active", label: S.tabActive, statuses: ["accepted", "on_the_way", "in_progress"] },
  { key: "completed", label: S.tabCompleted, statuses: ["completed", "rated"] },
  { key: "cancelled", label: S.tabCancelled, statuses: ["cancelled", "rejected"] },
];

type BookingRow = {
  id: string;
  status: BookingStatus;
  price: number | null;
  commission: number | null;
  created_at: string;
  customer: { full_name: string } | null;
  professional: { business_name: string } | null;
  category: { name_ar: string } | null;
  city: { name_ar: string } | null;
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const activeTab = TABS.find((t) => t.key === status) ?? TABS[0];

  const db = createAdminClient();
  let query = db
    .from("bookings")
    .select(
      `id, status, price, commission, created_at,
       customer:profiles!bookings_customer_id_fkey(full_name),
       professional:professionals!bookings_professional_id_fkey(business_name),
       category:categories(name_ar),
       city:cities(name_ar)`,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (activeTab.statuses) query = query.in("status", activeTab.statuses);

  const { data } = await query;
  const bookings = (data ?? []) as unknown as BookingRow[];

  return (
    <div>
      <PageHeader title={S.bookingsTitle} subtitle={`${bookings.length} ${S.results}`} />

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/bookings" : `/bookings?status=${t.key}`}
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
        {bookings.length === 0 ? (
          <EmptyState icon="📋" title={S.bookingsEmpty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{S.colId}</th>
                  <th>{S.colCustomer}</th>
                  <th>{S.colProfessional}</th>
                  <th>{S.colCategory}</th>
                  <th>{S.colCity}</th>
                  <th>{S.colPrice}</th>
                  <th>{S.colCommission}</th>
                  <th>{S.colStatus}</th>
                  <th>{S.colCreated}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link
                        href={`/bookings/${b.id}`}
                        className="font-mono text-xs font-semibold text-brand-600 hover:underline"
                        dir="ltr"
                      >
                        {shortId(b.id)}
                      </Link>
                    </td>
                    <td>{b.customer?.full_name || S.none}</td>
                    <td>{b.professional?.business_name || S.none}</td>
                    <td>{b.category?.name_ar || S.none}</td>
                    <td>{b.city?.name_ar || S.none}</td>
                    <td>{formatPrice(b.price)}</td>
                    <td>{formatPrice(b.commission)}</td>
                    <td>
                      <BookingStatusBadge status={b.status} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-[#8a7a6d]">
                      {formatDateTime(b.created_at)}
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
