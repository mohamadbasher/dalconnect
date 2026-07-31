"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function addCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();
  const name_ar = String(formData.get("name_ar") ?? "").trim();
  const name_he = String(formData.get("name_he") ?? "").trim();
  const icon = String(formData.get("icon") ?? "tools").trim() || "tools";
  const sort_order = Number(formData.get("sort_order") ?? 0) || 0;
  if (!slug || !name_ar || !name_he) return;

  const db = createAdminClient();
  await db.from("categories").insert({ slug, name_ar, name_he, icon, sort_order });
  revalidatePath("/categories");
}

export async function updateCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const name_ar = String(formData.get("name_ar") ?? "").trim();
  const name_he = String(formData.get("name_he") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim() || "tools";
  const sort_order = Number(formData.get("sort_order") ?? 0) || 0;
  if (!id || !name_ar || !name_he) return;

  const db = createAdminClient();
  await db
    .from("categories")
    .update({ name_ar, name_he, icon, sort_order })
    .eq("id", id);
  revalidatePath("/categories");
}

export async function toggleCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const active = String(formData.get("is_active") ?? "") === "true";
  if (!id) return;

  const db = createAdminClient();
  await db.from("categories").update({ is_active: !active }).eq("id", id);
  revalidatePath("/categories");
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;

  const db = createAdminClient();
  // Fails silently when bookings/professionals still reference the category —
  // deactivate instead in that case.
  await db.from("categories").delete().eq("id", id);
  revalidatePath("/categories");
}
