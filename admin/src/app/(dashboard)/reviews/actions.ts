"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

// NOTE: never recompute rating_avg / rating_count here. The `review_effects`
// trigger fires on INSERT/UPDATE/DELETE of `reviews` and recomputes the
// professional's aggregates from the published rows only — doing it in app
// code as well would race with the trigger and double-write.

export async function setReviewStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const reviewId = String(formData.get("reviewId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!reviewId || !["published", "hidden"].includes(status)) return;

  const db = createAdminClient();
  const { data: review } = await db
    .from("reviews")
    .select("professional_id, rating")
    .eq("id", reviewId)
    .maybeSingle();

  await db.from("reviews").update({ status }).eq("id", reviewId);

  await logAction(
    status === "hidden" ? "review.hide" : "review.publish",
    "review",
    reviewId,
    `${status === "hidden" ? "إخفاء" : "نشر"} تقييم بـ ${review?.rating ?? "?"} نجوم`,
    { status, professional_id: review?.professional_id ?? null },
  );

  revalidatePath("/reviews");
  revalidatePath("/professionals");
}

export async function deleteReview(formData: FormData): Promise<void> {
  await requireAdmin();
  const reviewId = String(formData.get("reviewId") ?? "");
  if (!reviewId) return;

  const db = createAdminClient();
  const { data: review } = await db
    .from("reviews")
    .select("professional_id, rating")
    .eq("id", reviewId)
    .maybeSingle();

  // Moderation delete. Aggregates are refreshed by the review_effects trigger,
  // which now also fires on DELETE — nothing to recompute here.
  await db.from("reviews").delete().eq("id", reviewId);

  await logAction(
    "review.delete",
    "review",
    reviewId,
    `حذف تقييم بـ ${review?.rating ?? "?"} نجوم`,
    { professional_id: review?.professional_id ?? null },
  );

  revalidatePath("/reviews");
  revalidatePath("/professionals");
}
