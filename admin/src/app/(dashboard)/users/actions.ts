"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function toggleBan(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const banned = String(formData.get("banned") ?? "") === "true";
  if (!userId) return;

  const db = createAdminClient();
  await db.from("profiles").update({ is_banned: !banned }).eq("id", userId);
  revalidatePath("/users");
}
