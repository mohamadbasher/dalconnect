"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Approve / reject a submitted profile photo.
 *
 * Both go through the SECURITY DEFINER RPCs rather than updating the columns
 * here, so the "only an admin may write avatar_url" rule lives in one place —
 * the database — instead of being re-stated (and eventually mis-stated) in
 * every caller. See migration 20260714000015.
 */
export async function approveAvatar(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const db = createAdminClient();
  await db.rpc("approve_avatar", { p_user_id: userId });
  revalidatePath("/avatars");
  revalidatePath("/");
}

export async function rejectAvatar(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const db = createAdminClient();
  await db.rpc("reject_avatar", { p_user_id: userId });
  revalidatePath("/avatars");
  revalidatePath("/");
}
