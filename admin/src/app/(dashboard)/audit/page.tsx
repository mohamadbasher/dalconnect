import Link from "next/link";
import { S, fmt } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ActorRoleBadge } from "@/components/StatusBadge";
import type { AuditLog, UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** Arabic label per `action` prefix — unknown prefixes fall back to the raw value. */
const ACTION_PREFIX_LABELS: Record<string, string> = {
  professional: S.auditActionProfessional,
  review: S.auditActionReview,
  legal: S.auditActionLegal,
  booking: S.auditActionBooking,
  user: S.auditActionUser,
  category: S.auditActionCategory,
  city: S.auditActionCity,
  banner: S.auditActionBanner,
  report: S.auditActionReport,
  setting: S.auditActionSetting,
  notification: S.auditActionNotification,
};

const ROLE_FILTERS: UserRole[] = ["admin", "professional", "customer"];
const ROLE_FILTER_LABELS: Record<UserRole, string> = {
  admin: S.roleAdmin,
  professional: S.roleProfessional,
  customer: S.roleCustomer,
};

/** Guards the value interpolated into the `like` pattern. */
function safePrefix(raw: string | undefined): string {
  return raw && /^[a-z_]{1,40}$/.test(raw) ? raw : "";
}

function buildHref(params: { action: string; role: string; page: number }): string {
  const sp = new URLSearchParams();
  if (params.action) sp.set("action", params.action);
  if (params.role) sp.set("role", params.role);
  if (params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/audit?${qs}` : "/audit";
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "border border-[#ece5dd] bg-white text-[#57493e] hover:bg-brand-50"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; role?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const actionPrefix = safePrefix(sp.action);
  const role = ROLE_FILTERS.includes(sp.role as UserRole) ? (sp.role as string) : "";
  const page = Math.max(1, Math.floor(Number(sp.page ?? 1)) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const db = createAdminClient();

  let query = db
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (actionPrefix) query = query.like("action", `${actionPrefix}.%`);
  if (role) query = query.eq("actor_role", role);

  const [logsRes, prefixRes] = await Promise.all([
    query,
    // Prefixes actually present in the log, so the filter bar stays truthful
    // even for actions written by something other than this panel.
    db.from("audit_logs").select("action").order("created_at", { ascending: false }).limit(500),
  ]);

  const logs = (logsRes.data ?? []) as unknown as AuditLog[];
  const total = logsRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const prefixes = Array.from(
    new Set(
      ((prefixRes.data ?? []) as { action: string }[])
        .map((r) => String(r.action).split(".")[0])
        .filter((p) => /^[a-z_]{1,40}$/.test(p)),
    ),
  ).sort();

  return (
    <div>
      <PageHeader title={S.auditTitle} subtitle={`${total} ${S.results}`} />

      {/* Actor name/role are snapshotted by log_action() at write time, so rows
          stay readable after the account behind actor_id is deleted. */}
      <div className="mb-4 rounded-lg border border-[#ece5dd] bg-white px-4 py-2.5 text-xs leading-5 text-[#8a7a6d]">
        ℹ️ {S.auditNote}
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#8a7a6d]">{S.auditFilterAction}:</span>
          <Chip
            href={buildHref({ action: "", role, page: 1 })}
            active={!actionPrefix}
            label={S.auditAll}
          />
          {prefixes.map((p) => (
            <Chip
              key={p}
              href={buildHref({ action: p, role, page: 1 })}
              active={actionPrefix === p}
              label={ACTION_PREFIX_LABELS[p] ?? p}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#8a7a6d]">{S.auditFilterRole}:</span>
          <Chip
            href={buildHref({ action: actionPrefix, role: "", page: 1 })}
            active={!role}
            label={S.auditAll}
          />
          {ROLE_FILTERS.map((r) => (
            <Chip
              key={r}
              href={buildHref({ action: actionPrefix, role: r, page: 1 })}
              active={role === r}
              label={ROLE_FILTER_LABELS[r]}
            />
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState icon="🧾" title={S.auditEmpty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{S.colTime}</th>
                  <th>{S.colActor}</th>
                  <th>{S.colAction}</th>
                  <th>{S.colSummary}</th>
                  <th>{S.colTarget}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const prefix = l.action.split(".")[0];
                  const hasMeta =
                    l.metadata && Object.keys(l.metadata as object).length > 0;
                  return (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap">
                        <div className="font-medium">{formatRelative(l.created_at)}</div>
                        <div className="text-[11px] text-[#8a7a6d]">
                          {formatDateTimeFull(l.created_at)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="font-semibold">{l.actor_name || S.none}</div>
                        <div className="mt-0.5">
                          <ActorRoleBadge role={l.actor_role} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="text-xs font-semibold">
                          {ACTION_PREFIX_LABELS[prefix] ?? prefix}
                        </div>
                        <code
                          className="font-mono text-[11px] text-[#8a7a6d]"
                          dir="ltr"
                        >
                          {l.action}
                        </code>
                      </td>
                      <td className="max-w-[360px]">
                        <div className="text-sm leading-6">{l.summary || S.none}</div>
                        {hasMeta && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[11px] text-brand-600">
                              {S.colMetadata}
                            </summary>
                            <pre
                              className="mt-1 overflow-x-auto rounded-lg bg-[#faf7f4] px-2 py-1.5 text-[11px] leading-5"
                              dir="ltr"
                            >
                              {JSON.stringify(l.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="text-xs">{l.target_type || S.none}</div>
                        {l.target_id && (
                          <code className="font-mono text-[11px] text-[#8a7a6d]" dir="ltr">
                            {l.target_id.length > 12
                              ? `${l.target_id.slice(0, 8)}…`
                              : l.target_id}
                          </code>
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link
              href={buildHref({ action: actionPrefix, role, page: page - 1 })}
              className="btn-outline"
            >
              {S.auditPrev}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-[#8a7a6d]">
            {fmt(S.auditPageOf, { n: page, total: totalPages })}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref({ action: actionPrefix, role, page: page + 1 })}
              className="btn-outline"
            >
              {S.auditNext}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
