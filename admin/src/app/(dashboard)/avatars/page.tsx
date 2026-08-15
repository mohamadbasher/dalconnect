import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { SubmitButton } from "@/components/SubmitButton";
import { approveAvatar, rejectAvatar } from "./actions";

export const dynamic = "force-dynamic";

type PendingAvatar = {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  avatar_url: string | null;
  pending_avatar_url: string | null;
  created_at: string;
};

/**
 * Profile photos waiting to be looked at.
 *
 * A photo is shown next to a real person's name to strangers who are about to
 * let them into their home, so it doesn't go live on upload — the mobile app
 * can only write `pending_avatar_url`, and `avatar_url` is admin-only at the
 * database level. This page is the other half of that.
 */
export default async function AvatarsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db
    .from("profiles")
    .select("id, full_name, phone, role, avatar_url, pending_avatar_url, created_at")
    .eq("avatar_status", "pending")
    .not("pending_avatar_url", "is", null)
    .order("created_at", { ascending: true });
  const pending = (data ?? []) as PendingAvatar[];

  return (
    <div>
      <PageHeader title={S.avatarsTitle} subtitle={`${pending.length} ${S.avatarsWaiting}`} />

      {pending.length === 0 ? (
        <div className="card">
          <EmptyState icon="🖼️" title={S.avatarsEmpty} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pending.map((p) => (
            <div key={p.id} className="card flex flex-col gap-3 p-4">
              {/* The submitted photo, big enough to actually judge. */}
              <div className="overflow-hidden rounded-xl bg-[#f3eee8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.pending_avatar_url ?? ""}
                  alt={p.full_name}
                  className="h-64 w-full object-contain"
                />
              </div>

              <div className="flex items-center gap-3">
                {/* what they're replacing, for context */}
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar_url}
                    alt=""
                    title={S.avatarsCurrent}
                    className="h-10 w-10 shrink-0 rounded-full object-cover opacity-70"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3eee8] text-xs text-[#8a7a6d]">
                    —
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.full_name}</div>
                  <div className="truncate text-xs text-[#8a7a6d]" dir="ltr">
                    {p.phone} · {formatDateTime(p.created_at)}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <form action={approveAvatar} className="flex-1">
                  <input type="hidden" name="userId" value={p.id} />
                  <SubmitButton label={S.avatarsApprove} className="btn-primary w-full !py-2 text-sm" />
                </form>
                <form action={rejectAvatar} className="flex-1">
                  <input type="hidden" name="userId" value={p.id} />
                  <SubmitButton label={S.avatarsReject} className="btn-danger w-full !py-2 text-sm" />
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
