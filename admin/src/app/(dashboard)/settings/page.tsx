import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { saveCommissionRate, saveRequestFees } from "./actions";
import type { NumericSettingKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const KEYS: NumericSettingKey[] = ["commission_rate", "fee_same_day", "fee_scheduled"];

/** Money field with a ₪ suffix — mirrors the % suffix on the commission input. */
function FeeInput({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-[#8a7a6d]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type="number"
          min={0}
          step={1}
          required
          defaultValue={value}
          className="input !w-40 pe-8"
          dir="ltr"
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-[#8a7a6d]">
          ₪
        </span>
      </div>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;
  const db = createAdminClient();

  // All numeric settings share one jsonb-number convention, so one round-trip.
  const { data } = await db.from("app_settings").select("key, value").in("key", KEYS);

  const settings = new Map<string, number>(
    ((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, Number(r.value)]),
  );
  const read = (key: NumericSettingKey, fallback: number): number => {
    const v = settings.get(key);
    return v === undefined || !Number.isFinite(v) ? fallback : v;
  };

  const rate = read("commission_rate", 0.1);
  const pct = Math.round(rate * 10000) / 100;

  const feeSameDay = read("fee_same_day", 0);
  const feeScheduled = read("fee_scheduled", 0);
  // Warning only — an urgent request being cheaper than a scheduled one is
  // almost certainly a typo, but the owner is allowed to save it anyway.
  const feesInverted = feeSameDay < feeScheduled;
  const feesUnpriced = feeSameDay === 0 && feeScheduled === 0;

  return (
    <div>
      <PageHeader title={S.settingsTitle} />

      {saved && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">
          ✓ {S.saved}
        </div>
      )}

      <div className="max-w-xl space-y-5">
        {/* Commission rate */}
        <section className="card p-5">
          <h2 className="section-title mb-1 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-brand-600" />
            {S.commissionRate}
          </h2>
          <p className="mb-4 text-sm text-[#8a7a6d]">{S.commissionHint}</p>
          <form action={saveCommissionRate} className="flex items-end gap-3">
            <div>
              <label
                htmlFor="commission_pct"
                className="mb-1 block text-xs font-semibold text-[#8a7a6d]"
              >
                {S.commissionRate} (%)
              </label>
              <div className="relative">
                <input
                  id="commission_pct"
                  name="commission_pct"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  required
                  defaultValue={pct}
                  className="input !w-36 pe-8"
                  dir="ltr"
                />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-[#8a7a6d]">
                  %
                </span>
              </div>
            </div>
            <SubmitButton label={S.save} />
          </form>
        </section>

        {/* Request fees — what the customer pays to post a request */}
        <section className="card p-5">
          <h2 className="section-title mb-1 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-brand-600" />
            {S.requestFees}
          </h2>
          <p className="mb-3 text-sm text-[#8a7a6d]">{S.requestFeesHint}</p>

          <div className="mb-4 rounded-lg border border-[#ece5dd] bg-[#faf7f4] px-3 py-2.5 text-xs leading-5 text-[#8a7a6d]">
            ℹ️ {S.requestFeesSnapshotNote}
          </div>

          {feesInverted && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 font-medium text-amber-800">
              ⚠️ {S.feeOrderWarning}
            </div>
          )}

          {feesUnpriced && (
            <div className="mb-4 rounded-lg border border-[#ece5dd] bg-white px-3 py-2.5 text-xs leading-5 text-[#8a7a6d]">
              {S.feeZeroNote}
            </div>
          )}

          <form action={saveRequestFees} className="flex flex-wrap items-end gap-3">
            <FeeInput id="fee_same_day" label={S.feeSameDay} value={feeSameDay} />
            <FeeInput id="fee_scheduled" label={S.feeScheduled} value={feeScheduled} />
            <SubmitButton label={S.save} />
          </form>
        </section>

        {/* Payments placeholder */}
        <section className="card p-5">
          <h2 className="section-title mb-1 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-stone-300" />
            {S.paymentsSection}
          </h2>
          <p className="text-sm leading-6 text-[#8a7a6d]">💳 {S.paymentsPlaceholder}</p>
        </section>
      </div>
    </div>
  );
}
