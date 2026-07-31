"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveCommissionRate(formData: FormData): Promise<void> {
  await requireAdmin();
  const pct = Number(formData.get("commission_pct") ?? NaN);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return;

  const rate = Math.round((pct / 100) * 10000) / 10000;
  const db = createAdminClient();
  await db
    .from("app_settings")
    .upsert({ key: "commission_rate", value: rate });

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}
