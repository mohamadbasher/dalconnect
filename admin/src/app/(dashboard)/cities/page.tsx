import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ActiveBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { addCity, deleteCity, toggleCity, updateCity } from "./actions";
import type { City } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROW_GRID = "grid grid-cols-[1fr_1fr_110px_110px_110px_90px_200px] items-center gap-3";

export default async function CitiesPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db
    .from("cities")
    .select("*")
    .order("name_ar", { ascending: true });
  const cities = (data ?? []) as City[];

  return (
    <div>
      <PageHeader title={S.citiesTitle} subtitle={`${cities.length} ${S.results}`} />

      {/* Add form */}
      <form action={addCity} className="card mb-5 p-4">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-brand-600" />
          {S.addCity}
        </h2>
        <div className="grid gap-3 md:grid-cols-5">
          <input name="name_ar" required placeholder={S.colNameAr} className="input" />
          <input name="name_he" required placeholder={S.colNameHe} className="input" dir="rtl" />
          <input name="area" placeholder={`${S.colArea} (${S.optional})`} className="input" />
          <input name="lat" type="number" step="any" placeholder={S.colLat} className="input" dir="ltr" />
          <input name="lng" type="number" step="any" placeholder={S.colLng} className="input" dir="ltr" />
        </div>
        <div className="mt-3">
          <SubmitButton label={`+ ${S.add}`} />
        </div>
      </form>

      {/* Inline-editable list */}
      <div className="card overflow-x-auto">
        {cities.length === 0 ? (
          <EmptyState icon="📍" title={S.citiesEmpty} />
        ) : (
          <div className="min-w-[950px] p-3">
            <div className={`${ROW_GRID} border-b border-[#ece5dd] px-2 pb-2 text-xs font-semibold text-[#8a7a6d]`}>
              <div>{S.colNameAr}</div>
              <div>{S.colNameHe}</div>
              <div>{S.colArea}</div>
              <div>{S.colLat}</div>
              <div>{S.colLng}</div>
              <div>{S.colActive}</div>
              <div>{S.colActions}</div>
            </div>
            {cities.map((c) => (
              <form
                key={c.id}
                action={updateCity}
                className={`${ROW_GRID} border-b border-[#f3eee8] px-2 py-2 last:border-b-0`}
              >
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="is_active" value={String(c.is_active)} />
                <input name="name_ar" defaultValue={c.name_ar} required className="input" />
                <input name="name_he" defaultValue={c.name_he} required className="input" dir="rtl" />
                <input name="area" defaultValue={c.area ?? ""} className="input" />
                <input name="lat" type="number" step="any" defaultValue={c.lat ?? ""} className="input" dir="ltr" />
                <input name="lng" type="number" step="any" defaultValue={c.lng ?? ""} className="input" dir="ltr" />
                <div>
                  <ActiveBadge active={c.is_active} />
                </div>
                <div className="flex gap-1.5">
                  <SubmitButton label={S.save} className="btn-primary !px-3 !py-1.5 text-xs" />
                  <button type="submit" formAction={toggleCity} className="btn-outline !px-3 !py-1.5 text-xs">
                    {c.is_active ? S.deactivate : S.activate}
                  </button>
                  <button type="submit" formAction={deleteCity} className="btn-danger !px-3 !py-1.5 text-xs">
                    {S.delete}
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
