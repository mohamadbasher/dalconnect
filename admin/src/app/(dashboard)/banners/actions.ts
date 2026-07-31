"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function addBanner(formData: FormData): Promise<void> {
  await requireAdmin();
  const file = formData.get("image") as File | null;
  const title = String(formData.get("title") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim() || null;
  const sort_order = Number(formData.get("sort_order") ?? 0) || 0;
  if (!file || file.size === 0) return;

  const db = createAdminClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `admin/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await db.storage
    .from("banners")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) return;

  const {
    data: { publicUrl },
  } = db.storage.from("banners").getPublicUrl(path);

  await db.from("banners").insert({ image_url: publicUrl, title, link, sort_order });
  revalidatePath("/banners");
}

export async function toggleBanner(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("is_active") ?? "") === "true";
  if (!id) return;

  const db = createAdminClient();
  await db.from("banners").update({ is_active: !active }).eq("id", id);
  revalidatePath("/banners");
}

export async function updateBannerSort(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const sort_order = Number(formData.get("sort_order") ?? 0) || 0;
  if (!id) return;

  const db = createAdminClient();
  await db.from("banners").update({ sort_order }).eq("id", id);
  revalidatePath("/banners");
}

export async function deleteBanner(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const imageUrl = String(formData.get("image_url") ?? "");
  if (!id) return;

  const db = createAdminClient();
  await db.from("banners").delete().eq("id", id);

  // Best-effort: remove the file from storage too.
  const marker = "/banners/";
  const idx = imageUrl.indexOf(marker);
  if (idx >= 0) {
    const path = decodeURIComponent(imageUrl.slice(idx + marker.length));
    await db.storage.from("banners").remove([path]);
  }
  revalidatePath("/banners");
}
