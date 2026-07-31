"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = ["open", "in_review", "resolved", "dismissed"];

export async function setReportStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!reportId || !VALID_STATUSES.includes(status)) return;

  const db = createAdminClient();
  await db.from("reports").update({ status }).eq("id", reportId);
  revalidatePath("/reports");
  revalidatePath("/");
}
