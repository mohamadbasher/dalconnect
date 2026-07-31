import { S, fmt } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { broadcastNotification } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; capped?: string; error?: string }>;
}) {
  await requireAdmin();
  const { sent, capped, error } = await searchParams;

  return (
    <div>
      <PageHeader title={S.notificationsTitle} />

      <div className="max-w-xl space-y-4">
        {sent && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">
            ✓ {fmt(S.notifSent, { n: sent })}
          </div>
        )}
        {capped && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
            ⚠️ {fmt(S.notifCapWarning, { cap: 5000 })}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {S.actionError}
          </div>
        )}

        <form action={broadcastNotification} className="card space-y-4 p-5">
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-semibold">
              {S.notifTitleLabel}
            </label>
            <input id="title" name="title" required maxLength={120} className="input" />
          </div>
          <div>
            <label htmlFor="body" className="mb-1.5 block text-sm font-semibold">
              {S.notifBodyLabel}
            </label>
            <textarea
              id="body"
              name="body"
              rows={4}
              maxLength={500}
              className="input resize-y"
            />
          </div>
          <div>
            <label htmlFor="audience" className="mb-1.5 block text-sm font-semibold">
              {S.notifAudience}
            </label>
            <select id="audience" name="audience" className="input" defaultValue="all">
              <option value="all">{S.audienceAll}</option>
              <option value="customers">{S.audienceCustomers}</option>
              <option value="professionals">{S.audienceProfessionals}</option>
            </select>
          </div>
          <SubmitButton label={`📣 ${S.send}`} pendingLabel={S.loading} className="btn-primary w-full" />
          <p className="text-xs leading-5 text-[#8a7a6d]">ℹ️ {S.notifPushNote}</p>
        </form>
      </div>
    </div>
  );
}
