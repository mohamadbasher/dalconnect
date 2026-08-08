"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * `app_settings.value` is jsonb and every numeric setting is stored as a bare
 * JSON number (`0.1`, `25`) — not as a string and not wrapped in an object.
 * The DB reads them back with `(value)::text::numeric` (see `commission_rate()`
 * and `request_fee()`), so anything other than a bare number breaks the SQL side.
 */
async function upsertNumericSetting(
  db: ReturnType<typeof createAdminClient>,
  key: string,
  value: number,
): Promise<void> {
  await db.from("app_settings").upsert({ key, value });
}

export async function saveCommissionRate(formData: FormData): Promise<void> {
  await requireAdmin();
  const pct = Number(formData.get("commission_pct") ?? NaN);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return;

  const rate = Math.round((pct / 100) * 10000) / 10000;
  const db = createAdminClient();
  await upsertNumericSetting(db, "commission_rate", rate);

  await logAction(
    "setting.commission_rate",
    "app_setting",
    "commission_rate",
    `تحديث نسبة العمولة إلى ${pct}%`,
    { commission_rate: rate, percent: pct },
  );

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

/**
 * Request fees — what the customer pays to POST a request, per urgency.
 *
 * Validation: both values must be finite and non-negative, otherwise nothing is
 * written. A same-day fee below the scheduled fee is unusual but legitimate
 * (e.g. a promo), so it only raises a warning on the page — it never blocks.
 */
export async function saveRequestFees(formData: FormData): Promise<void> {
  await requireAdmin();

  const sameDay = Number(formData.get("fee_same_day") ?? NaN);
  const scheduled = Number(formData.get("fee_scheduled") ?? NaN);
  if (!Number.isFinite(sameDay) || !Number.isFinite(scheduled)) return;
  if (sameDay < 0 || scheduled < 0) return;

  const feeSameDay = Math.round(sameDay * 100) / 100;
  const feeScheduled = Math.round(scheduled * 100) / 100;

  const db = createAdminClient();
  await Promise.all([
    upsertNumericSetting(db, "fee_same_day", feeSameDay),
    upsertNumericSetting(db, "fee_scheduled", feeScheduled),
  ]);

  // Existing bookings are untouched on purpose: `set_request_fee` snapshots the
  // fee onto `bookings.service_fee` at INSERT, so this only affects new requests.
  await logAction(
    "setting.request_fees",
    "app_setting",
    "request_fees",
    `تحديث رسوم الطلبات — عاجل: ₪${feeSameDay} · مجدول: ₪${feeScheduled}`,
    {
      fee_same_day: feeSameDay,
      fee_scheduled: feeScheduled,
      same_day_below_scheduled: feeSameDay < feeScheduled,
    },
  );

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}
