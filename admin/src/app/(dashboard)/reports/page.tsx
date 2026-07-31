import Link from "next/link";
import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, shortId } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ReportStatusBadge, REPORT_LABELS } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { setReportStatus } from "./actions";
import type { ReportStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type ReportRow = {
  id: string;
  reason: string;
  details: string;
  status: ReportStatus;
  booking_id: string | null;
  created_at: string;
  reporter: { full_name: string; phone: string } | null;
  reported: { full_name: string; phone: string } | null;
};

const STATUS_ORDER: ReportStatus[] = ["open", "in_review", "resolved", "dismissed"];

function UserLink({ user }: { user: { full_name: string; phone: string } | null }) {
  if (!user) return <span className="text-[#8a7a6d]">{S.none}</span>;
  const q = user.phone || user.full_name;
  return (
    <Link
      href={`/users?q=${encodeURIComponent(q)}`}
      className="font-semibold text-brand-600 hover:underline"
    >
      {user.full_name || user.phone || S.none}
    </Link>
  );
}

export default async function ReportsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db
    .from("reports")
    .select(
      `id, reason, details, status, booking_id, created_at,
       reporter:profiles!reports_reporter_id_fkey(full_name, phone),
       reported:profiles!reports_reported_user_id_fkey(full_name, phone)`,
    )
    .order("created_at", { ascending: false })
    .limit(300);

  const reports = (data ?? []) as unknown as ReportRow[];
  // Open first, then in_review, resolved, dismissed — newest first inside each group.
  reports.sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  return (
    <div>
      <PageHeader title={S.reportsTitle} subtitle={`${reports.length} ${S.results}`} />

      {reports.length === 0 ? (
        <div className="card">
          <EmptyState icon="🚩" title={S.reportsEmpty} />
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{r.reason}</span>
                    <ReportStatusBadge status={r.status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8a7a6d]">
                    <span>
                      {S.colReporter}: <UserLink user={r.reporter} />
                    </span>
                    <span>
                      {S.colReported}: <UserLink user={r.reported} />
                    </span>
                    {r.booking_id && (
                      <span>
                        {S.colBooking}:{" "}
                        <Link
                          href={`/bookings/${r.booking_id}`}
                          className="font-mono font-semibold text-brand-600 hover:underline"
                          dir="ltr"
                        >
                          {shortId(r.booking_id)}
                        </Link>
                      </span>
                    )}
                    <span>{formatDateTime(r.created_at)}</span>
                  </div>
                </div>

                <form action={setReportStatus} className="flex shrink-0 items-center gap-2">
                  <input type="hidden" name="reportId" value={r.id} />
                  <select
                    name="status"
                    defaultValue={r.status}
                    className="input !w-auto !py-1.5 text-xs"
                  >
                    {STATUS_ORDER.map((st) => (
                      <option key={st} value={st}>
                        {REPORT_LABELS[st]}
                      </option>
                    ))}
                  </select>
                  <SubmitButton label={S.save} className="btn-primary !px-3 !py-1.5 text-xs" />
                </form>
              </div>

              {r.details && (
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[#faf7f4] px-3 py-2 text-sm leading-6">
                  {r.details}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
