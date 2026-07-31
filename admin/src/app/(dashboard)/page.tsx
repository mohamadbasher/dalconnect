import Link from "next/link";
import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, formatPrice, shortId } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { BookingStatusBadge, ReportStatusBadge } from "@/components/StatusBadge";
import type { BookingStatus, ReportStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type LatestBooking = {
  id: string;
  status: BookingStatus;
  price: number | null;
  created_at: string;
  customer: { full_name: string } | null;
  professional: { business_name: string } | null;
  category: { name_ar: string } | null;
};

type LatestReport = {
  id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reporter: { full_name: string } | null;
};

function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  icon: string;
  href?: string;
}) {
  const body = (
    <div className="card flex items-center gap-3 p-4 transition hover:border-brand-200">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-[#8a7a6d]">{label}</div>
        <div className="text-lg font-extrabold leading-tight">{value}</div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function OverviewPage() {
  await requireAdmin();
  const db = createAdminClient();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    users,
    pros,
    pendingVer,
    bookingsToday,
    openBookings,
    completedJobs,
    commissionRows,
    openReports,
    latestBookings,
    latestReports,
  ] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("professionals").select("id", { count: "exact", head: true }),
    db
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay),
    db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "pending", "accepted", "on_the_way", "in_progress"]),
    db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("status", ["completed", "rated"]),
    db.from("transactions").select("commission").gte("created_at", startOfMonth),
    db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    db
      .from("bookings")
      .select(
        `id, status, price, created_at,
         customer:profiles!bookings_customer_id_fkey(full_name),
         professional:professionals!bookings_professional_id_fkey(business_name),
         category:categories(name_ar)`,
      )
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("reports")
      .select(
        `id, reason, status, created_at,
         reporter:profiles!reports_reporter_id_fkey(full_name)`,
      )
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const commissionMonth = (commissionRows.data ?? []).reduce(
    (sum: number, r: { commission: number | null }) => sum + Number(r.commission ?? 0),
    0,
  );

  const bookings = (latestBookings.data ?? []) as unknown as LatestBooking[];
  const reports = (latestReports.data ?? []) as unknown as LatestReport[];

  return (
    <div>
      <PageHeader title={S.overviewTitle} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={S.statUsers} value={users.count ?? 0} icon="👥" href="/users" />
        <StatCard label={S.statProfessionals} value={pros.count ?? 0} icon="🛠️" href="/professionals" />
        <StatCard
          label={S.statPendingVerifications}
          value={pendingVer.count ?? 0}
          icon="🪪"
          href="/professionals"
        />
        <StatCard label={S.statBookingsToday} value={bookingsToday.count ?? 0} icon="🗓️" href="/bookings" />
        <StatCard label={S.statOpenBookings} value={openBookings.count ?? 0} icon="⏳" href="/bookings?status=active" />
        <StatCard
          label={S.statCompletedJobs}
          value={completedJobs.count ?? 0}
          icon="✅"
          href="/bookings?status=completed"
        />
        <StatCard label={S.statCommissionMonth} value={formatPrice(commissionMonth)} icon="💰" href="/settings" />
        <StatCard label={S.statOpenReports} value={openReports.count ?? 0} icon="🚩" href="/reports" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        {/* Latest bookings */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#ece5dd] px-4 py-3">
            <h2 className="section-title flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-brand-600" />
              {S.latestBookings}
            </h2>
            <Link href="/bookings" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              {S.viewAll} ←
            </Link>
          </div>
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
                    <th>{S.colPrice}</th>
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
                      <td>{formatPrice(b.price)}</td>
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
        </section>

        {/* Latest reports */}
        <section className="card overflow-hidden self-start">
          <div className="flex items-center justify-between border-b border-[#ece5dd] px-4 py-3">
            <h2 className="section-title flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-brand-600" />
              {S.latestReports}
            </h2>
            <Link href="/reports" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              {S.viewAll} ←
            </Link>
          </div>
          {reports.length === 0 ? (
            <EmptyState icon="🚩" title={S.reportsEmpty} />
          ) : (
            <ul className="divide-y divide-[#f3eee8]">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.reason}</div>
                    <div className="mt-0.5 text-xs text-[#8a7a6d]">
                      {r.reporter?.full_name || S.none} · {formatDateTime(r.created_at)}
                    </div>
                  </div>
                  <ReportStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
