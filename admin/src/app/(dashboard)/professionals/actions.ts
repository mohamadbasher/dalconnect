"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setVerification(formData: FormData): Promise<void> {
  await requireAdmin();
  const proId = String(formData.get("proId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!proId || !["approved", "rejected"].includes(status)) return;

  const db = createAdminClient();
  await db
    .from("professionals")
    .update({ verification_status: status })
    .eq("id", proId);
  revalidatePath("/professionals");
  revalidatePath("/");
}
