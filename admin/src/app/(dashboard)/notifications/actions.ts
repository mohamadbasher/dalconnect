"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const CAP = 5000;
const BATCH = 1000;

export async function broadcastNotification(formData: FormData): Promise<void> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all");
  if (!title) redirect("/notifications?error=1");

  const db = createAdminClient();

  let query = db.from("profiles").select("id").eq("is_banned", false).limit(CAP + 1);
  if (audience === "customers") query = query.eq("role", "customer");
  else if (audience === "professionals") query = query.eq("role", "professional");

  const { data: users, error } = await query;
  if (error || !users) redirect("/notifications?error=1");

  const capped = users!.length > CAP;
  const targets = users!.slice(0, CAP);

  // Batch insert — a DB webhook on `notifications` triggers the push edge function.
  for (let i = 0; i < targets.length; i += BATCH) {
    const rows = targets.slice(i, i + BATCH).map((u: { id: string }) => ({
      user_id: u.id,
      type: "promo",
      title,
      body,
      data: { source: "admin_broadcast" },
    }));
    const { error: insertError } = await db.from("notifications").insert(rows);
    if (insertError) redirect("/notifications?error=1");
  }

  redirect(`/notifications?sent=${targets.length}${capped ? "&capped=1" : ""}`);
}
