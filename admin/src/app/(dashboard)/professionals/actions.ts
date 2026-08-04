"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY_MS = 86_400_000;

export async function setVerification(formData: FormData): Promise<void> {
  await requireAdmin();
  const proId = String(formData.get("proId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!proId || !["approved", "rejected"].includes(status)) return;

  const db = createAdminClient();
  const { data: pro } = await db
    .from("professionals")
    .select("business_name")
    .eq("id", proId)
    .maybeSingle();

  await db
    .from("professionals")
    .update({ verification_status: status })
    .eq("id", proId);

  const name = String(pro?.business_name ?? "") || proId.slice(0, 8);
  await logAction(
    status === "approved" ? "professional.approve" : "professional.reject",
    "professional",
    proId,
    `${status === "approved" ? "قبول" : "رفض"} توثيق «${name}»`,
    { status },
  );

  revalidatePath("/professionals");
  revalidatePath("/");
}

/**
 * Turns promotion on/off, or updates the duration of a running promotion.
 * `featured_until = now() + days`; an empty/zero duration means open-ended.
 */
export async function setFeatured(formData: FormData): Promise<void> {
  await requireAdmin();
  const proId = String(formData.get("proId") ?? "");
  const on = String(formData.get("featured") ?? "") === "true";
  const rawDays = String(formData.get("days") ?? "").trim();
  const days = rawDays ? Math.floor(Number(rawDays)) : 0;
  if (!proId) return;

  const db = createAdminClient();
  const { data: pro } = await db
    .from("professionals")
    .select("business_name, featured, featured_sort")
    .eq("id", proId)
    .maybeSingle();
  if (!pro) return;

  const name = String(pro.business_name ?? "") || proId.slice(0, 8);
  let until: string | null = null;

  if (on) {
    until =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * DAY_MS).toISOString()
        : null;

    // A newly promoted pro goes to the end of the featured order.
    let sort = Number(pro.featured_sort ?? 0);
    if (!pro.featured) {
      const { data: last } = await db
        .from("professionals")
        .select("featured_sort")
        .eq("featured", true)
        .order("featured_sort", { ascending: false })
        .limit(1)
        .maybeSingle();
      sort = Number(last?.featured_sort ?? 0) + 1;
    }

    await db
      .from("professionals")
      .update({ featured: true, featured_until: until, featured_sort: sort })
      .eq("id", proId);
  } else {
    await db
      .from("professionals")
      .update({ featured: false, featured_until: null, featured_sort: 0 })
      .eq("id", proId);
  }

  await logAction(
    on ? "professional.feature" : "professional.unfeature",
    "professional",
    proId,
    on
      ? `ترويج «${name}»${days > 0 ? ` لمدة ${days} يوم` : " بلا تاريخ انتهاء"}`
      : `إيقاف ترويج «${name}»`,
    { days: days > 0 ? days : null, featured_until: until },
  );

  revalidatePath("/professionals");
}

/**
 * Moves one promoted pro up/down.
 *
 * Read → swap → rewrite of the WHOLE featured set happens inside this single
 * action, so `featured_sort` is always renormalised to a contiguous 1..n and
 * the ordering can never drift (no gaps, no duplicate ranks) even if rows were
 * promoted at different times.
 */
export async function moveFeatured(formData: FormData): Promise<void> {
  await requireAdmin();
  const proId = String(formData.get("proId") ?? "");
  const dir = String(formData.get("dir") ?? "");
  if (!proId || (dir !== "up" && dir !== "down")) return;

  const db = createAdminClient();
  const { data } = await db
    .from("professionals")
    .select("id, business_name, featured_sort")
    .eq("featured", true)
    .order("featured_sort", { ascending: true })
    .order("id", { ascending: true });

  const rows = (data ?? []) as { id: string; business_name: string; featured_sort: number }[];
  const ids = rows.map((r) => r.id);
  const idx = ids.indexOf(proId);
  const target = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || target < 0 || target >= ids.length) return;

  [ids[idx], ids[target]] = [ids[target], ids[idx]];

  for (let i = 0; i < ids.length; i++) {
    await db.from("professionals").update({ featured_sort: i + 1 }).eq("id", ids[i]);
  }

  const name = rows[idx]?.business_name || proId.slice(0, 8);
  await logAction(
    "professional.feature_reorder",
    "professional",
    proId,
    `${dir === "up" ? "تقديم" : "تأخير"} «${name}» في ترتيب المميّزين إلى المركز ${target + 1}`,
    { direction: dir, position: target + 1, order: ids },
  );

  revalidatePath("/professionals");
}
