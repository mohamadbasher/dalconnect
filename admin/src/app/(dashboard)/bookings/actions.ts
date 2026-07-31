"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function adminCancelBooking(formData: FormData): Promise<void> {
  await requireAdmin();
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!bookingId) return;

  const db = createAdminClient();
  await db
    .from("bookings")
    .update({ status: "cancelled", cancel_reason: "cancelled by admin" })
    .eq("id", bookingId)
    .in("status", ["open", "pending", "accepted", "on_the_way", "in_progress"]);

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
}
