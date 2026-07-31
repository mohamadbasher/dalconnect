import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { saveCommissionRate } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;
  const db = createAdminClient();

  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "commission_rate")
    .maybeSingle();

  const rate = Number(data?.value ?? 0.1);
  const pct = Math.round(rate * 10000) / 100;

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
