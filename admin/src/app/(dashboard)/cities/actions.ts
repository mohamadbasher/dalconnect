"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function addCity(formData: FormData): Promise<void> {
  await requireAdmin();
  const name_ar = String(formData.get("name_ar") ?? "").trim();
  const name_he = String(formData.get("name_he") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim() || null;
  const lat = numOrNull(formData.get("lat"));
  const lng = numOrNull(formData.get("lng"));
  if (!name_ar || !name_he) return;

  const db = createAdminClient();
  await db.from("cities").insert({ name_ar, name_he, area, lat, lng });
  revalidatePath("/cities");
}

export async function updateCity(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const name_ar = String(formData.get("name_ar") ?? "").trim();
  const name_he = String(formData.get("name_he") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim() || null;
  const lat = numOrNull(formData.get("lat"));
  const lng = numOrNull(formData.get("lng"));
  if (!id || !name_ar || !name_he) return;

  const db = createAdminClient();
  await db.from("cities").update({ name_ar, name_he, area, lat, lng }).eq("id", id);
  revalidatePath("/cities");
}

export async function toggleCity(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const active = String(formData.get("is_active") ?? "") === "true";
  if (!id) return;

  const db = createAdminClient();
  await db.from("cities").update({ is_active: !active }).eq("id", id);
  revalidatePath("/cities");
}

export async function deleteCity(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;

  const db = createAdminClient();
  // Fails silently when profiles/bookings still reference the city.
  await db.from("cities").delete().eq("id", id);
  revalidatePath("/cities");
}
