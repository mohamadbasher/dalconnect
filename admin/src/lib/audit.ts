import { createClient } from "@/lib/supabase/server";

/**
 * Writes one `audit_logs` row through the `log_action` RPC.
 *
 * ⚠️ MUST run on the **user-scoped** cookie client, never the service-role one:
 * `log_action` resolves the actor with `auth.uid()`, and the service-role
 * client has no user attached — the entry would land with a null actor and an
 * empty name/role. Server actions therefore mutate with `createAdminClient()`
 * (bypassing RLS) and call this helper separately.
 *
 * The RPC snapshots the actor's name and role into the row, so the log stays
 * readable after the account is deleted.
 */
export async function logAction(
  action: string,
  targetType: string = "",
  targetId: string | null = null,
  summary: string = "",
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_action", {
      p_action: action,
      p_target_type: targetType,
      p_target_id: targetId,
      p_summary: summary,
      p_metadata: metadata,
    });
  } catch {
    // Auditing is best-effort: it must never fail the mutation it describes.
  }
}
