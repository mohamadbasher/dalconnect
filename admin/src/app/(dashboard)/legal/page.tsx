import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { saveLegalPage } from "./actions";
import { LEGAL_KEYS, LEGAL_KEY_ICONS, LEGAL_KEY_LABELS } from "./keys";
import type { LegalPage, LegalPageKey } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The mobile app ships built-in text for every legal page and only swaps in
 * the CMS copy when a row exists **and** the body for that language is
 * non-empty (see mobile/app/legal.tsx). The badges below mirror that rule
 * exactly — an empty body is not an override, it is a fallback.
 */
function isOverridden(row: LegalPage | undefined, lang: "ar" | "he"): boolean {
  if (!row) return false;
  return (lang === "ar" ? row.body_ar : row.body_he).trim().length > 0;
}

function LangBadge({ overridden, label }: { overridden: boolean; label: string }) {
  return (
    <span
      className={`badge ${
        overridden
          ? "border border-brand-200 bg-brand-50 text-brand-700"
          : "border border-stone-200 bg-stone-100 text-stone-600"
      }`}
    >
      {label}
    </span>
  );
}

export default async function LegalPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { key: openKey, saved } = await searchParams;

  const db = createAdminClient();
  const { data } = await db.from("legal_pages").select("*");
  const rows = (data ?? []) as LegalPage[];
  const byKey = new Map<LegalPageKey, LegalPage>(rows.map((r) => [r.key, r]));

  return (
    <div>
      <PageHeader title={S.legalTitle} subtitle={S.legalSubtitle} />

      {saved && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">
          ✓ {S.saved}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-5 text-amber-800">
        ⚠️ {S.legalOverrideWarning}
      </div>

      <div className="space-y-3">
        {LEGAL_KEYS.map((k) => {
          const row = byKey.get(k);
          const arOverride = isOverridden(row, "ar");
          const heOverride = isOverridden(row, "he");
          const anyOverride = arOverride || heOverride;

          return (
            <details key={k} open={openKey === k} className="card overflow-hidden">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2.5 px-4 py-3.5 hover:bg-[#fdfaf7]">
                <span className="text-lg leading-none">{LEGAL_KEY_ICONS[k]}</span>
                <span className="font-bold">{LEGAL_KEY_LABELS[k]}</span>
                <span className="font-mono text-[11px] text-[#8a7a6d]" dir="ltr">
                  {k}
                </span>
                {anyOverride ? (
                  <>
                    <LangBadge
                      overridden={arOverride}
                      label={arOverride ? S.legalArCustom : S.legalArBuiltIn}
                    />
                    <LangBadge
                      overridden={heOverride}
                      label={heOverride ? S.legalHeCustom : S.legalHeBuiltIn}
                    />
                  </>
                ) : (
                  <span className="badge border border-stone-200 bg-stone-100 text-stone-600">
                    {S.legalBuiltIn}
                  </span>
                )}
                <span className="ms-auto text-[11px] text-[#8a7a6d]">
                  {S.legalUpdatedAt}:{" "}
                  {row ? formatDateTimeFull(row.updated_at) : S.legalNeverSaved}
                </span>
              </summary>

              <form
                action={saveLegalPage}
                className="space-y-4 border-t border-[#ece5dd] bg-[#fdfbf9] p-4"
              >
                <input type="hidden" name="key" value={k} />

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`title_ar_${k}`}
                      className="mb-1.5 block text-xs font-semibold text-[#8a7a6d]"
                    >
                      {S.legalTitleAr}
                    </label>
                    <input
                      id={`title_ar_${k}`}
                      name="title_ar"
                      defaultValue={row?.title_ar ?? ""}
                      maxLength={200}
                      className="input"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`title_he_${k}`}
                      className="mb-1.5 block text-xs font-semibold text-[#8a7a6d]"
                    >
                      {S.legalTitleHe}
                    </label>
                    <input
                      id={`title_he_${k}`}
                      name="title_he"
                      defaultValue={row?.title_he ?? ""}
                      maxLength={200}
                      className="input"
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`body_ar_${k}`}
                      className="mb-1.5 block text-xs font-semibold text-[#8a7a6d]"
                    >
                      {S.legalBodyAr}
                    </label>
                    <textarea
                      id={`body_ar_${k}`}
                      name="body_ar"
                      defaultValue={row?.body_ar ?? ""}
                      rows={14}
                      className="input resize-y font-normal leading-6"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`body_he_${k}`}
                      className="mb-1.5 block text-xs font-semibold text-[#8a7a6d]"
                    >
                      {S.legalBodyHe}
                    </label>
                    <textarea
                      id={`body_he_${k}`}
                      name="body_he"
                      defaultValue={row?.body_he ?? ""}
                      rows={14}
                      className="input resize-y font-normal leading-6"
                      dir="rtl"
                    />
                  </div>
                </div>

                <p className="text-xs text-[#8a7a6d]">💡 {S.legalBodyHint}</p>
                <SubmitButton label={S.save} pendingLabel={S.loading} />
              </form>
            </details>
          );
        })}
      </div>
    </div>
  );
}
