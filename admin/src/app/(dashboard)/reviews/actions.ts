"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteReview(formData: FormData): Promise<void> {
  await requireAdmin();
  const reviewId = String(formData.get("reviewId") ?? "");
  if (!reviewId) return;

  const db = createAdminClient();
  // Moderation delete. Aggregates (rating_avg / rating_count) are refreshed
  // by the review_effects trigger on the professional's NEXT review — v1.
  await db.from("reviews").delete().eq("id", reviewId);
  revalidatePath("/reviews");
}
