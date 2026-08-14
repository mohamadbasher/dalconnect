import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ActiveBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { addCategory, deleteCategory, toggleCategory, togglePopular, updateCategory } from "./actions";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROW_GRID =
  "grid grid-cols-[120px_1fr_1fr_140px_70px_130px_80px_190px] items-center gap-3";

export default async function CategoriesPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  const categories = (data ?? []) as Category[];

  // What the customer home screen currently leads with, in its real order.
  const featured = categories
    .filter((c) => c.is_popular)
    .sort((a, b) => a.popular_sort - b.popular_sort);
  // The home grid is 4 tiles per row, so anything off a multiple of 4 leaves a
  // ragged last row.
  const ragged = featured.length > 0 && featured.length % 4 !== 0;

  return (
    <div>
      <PageHeader title={S.categoriesTitle} subtitle={`${categories.length} ${S.results}`} />

      {/* Home-screen lineup — the one thing here a customer sees first. */}
      <div className="card mb-5 p-4">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-brand-600" />
          {S.colPopular}
        </h2>
        {featured.length === 0 ? (
          <p className="text-sm text-[#8a7a6d]">⚠️ {S.popularEmptyHint}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {featured.map((c, i) => (
                <span
                  key={c.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                    c.is_active
                      ? "bg-brand-50 text-brand-700"
                      : "bg-[#f3eee8] text-[#8a7a6d] line-through"
                  }`}
                  title={c.is_active ? undefined : S.deactivate}
                >
                  <span className="font-mono opacity-60">{i + 1}</span>
                  {c.name_ar}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#8a7a6d]">
              {featured.length} {S.popularCountSuffix}
              {ragged ? ` · ${S.popularRaggedHint}` : ""}
            </p>
          </>
        )}
      </div>

      {/* Add form */}
      <form action={addCategory} className="card mb-5 p-4">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-brand-600" />
          {S.addCategory}
        </h2>
        <div className="grid gap-3 md:grid-cols-5">
          <input name="slug" required placeholder={S.colSlug} className="input" dir="ltr" />
          <input name="name_ar" required placeholder={S.colNameAr} className="input" />
          <input name="name_he" required placeholder={S.colNameHe} className="input" dir="rtl" />
          <input name="icon" placeholder={S.colIcon} className="input" dir="ltr" title={S.iconHint} />
          <input name="sort_order" type="number" placeholder={S.colSort} className="input" dir="ltr" />
        </div>
        <p className="mt-2 text-xs text-[#8a7a6d]">💡 {S.iconHint}</p>
        <div className="mt-3">
          <SubmitButton label={`+ ${S.add}`} />
        </div>
      </form>

      {/* Inline-editable list */}
      <div className="card overflow-x-auto">
        {categories.length === 0 ? (
          <EmptyState icon="🗂️" title={S.categoriesEmpty} />
        ) : (
          <div className="min-w-[1020px] p-3">
            <div className={`${ROW_GRID} border-b border-[#ece5dd] px-2 pb-2 text-xs font-semibold text-[#8a7a6d]`}>
              <div>{S.colIcon}</div>
              <div>{S.colNameAr}</div>
              <div>{S.colNameHe}</div>
              <div>{S.colSlug}</div>
              <div>{S.colSort}</div>
              <div>{S.colPopular}</div>
              <div>{S.colActive}</div>
              <div>{S.colActions}</div>
            </div>
            {categories.map((c) => (
              <form
                key={c.id}
                action={updateCategory}
                className={`${ROW_GRID} border-b border-[#f3eee8] px-2 py-2 last:border-b-0`}
              >
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="is_active" value={String(c.is_active)} />
                <input type="hidden" name="is_popular" value={String(c.is_popular)} />
                <input name="icon" defaultValue={c.icon} className="input" dir="ltr" title={S.iconHint} />
                <input name="name_ar" defaultValue={c.name_ar} required className="input" />
                <input name="name_he" defaultValue={c.name_he} required className="input" dir="rtl" />
                <div className="truncate font-mono text-xs text-[#8a7a6d]" dir="ltr" title={c.slug}>
                  {c.slug}
                </div>
                <input name="sort_order" type="number" defaultValue={c.sort_order} className="input" dir="ltr" />
                {/* Star toggles it onto the home screen; the number orders it there.
                    The number is only rendered when featured — otherwise it would
                    invite editing a value nothing reads. It still posts (as 0) so
                    Save never wipes an order the admin didn't touch. */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    formAction={togglePopular}
                    title={c.is_popular ? S.popularRemove : S.popularAdd}
                    aria-label={c.is_popular ? S.popularRemove : S.popularAdd}
                    className={`rounded-lg px-2 py-1 text-base leading-none transition ${
                      c.is_popular
                        ? "bg-brand-50 text-brand-600"
                        : "text-[#cbbfb3] hover:bg-[#f7f3ee] hover:text-[#8a7a6d]"
                    }`}
                  >
                    {c.is_popular ? "★" : "☆"}
                  </button>
                  {c.is_popular ? (
                    <input
                      name="popular_sort"
                      type="number"
                      defaultValue={c.popular_sort}
                      className="input !w-14 !px-2"
                      dir="ltr"
                      title={S.popularSortHint}
                    />
                  ) : (
                    <input type="hidden" name="popular_sort" value={c.popular_sort} />
                  )}
                </div>
                <div>
                  <ActiveBadge active={c.is_active} />
                </div>
                <div className="flex gap-1.5">
                  <SubmitButton label={S.save} className="btn-primary !px-3 !py-1.5 text-xs" />
                  <button type="submit" formAction={toggleCategory} className="btn-outline !px-3 !py-1.5 text-xs">
                    {c.is_active ? S.deactivate : S.activate}
                  </button>
                  <button type="submit" formAction={deleteCategory} className="btn-danger !px-3 !py-1.5 text-xs">
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
