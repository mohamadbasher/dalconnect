import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ActiveBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { addCategory, deleteCategory, toggleCategory, updateCategory } from "./actions";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROW_GRID = "grid grid-cols-[130px_1fr_1fr_150px_70px_90px_200px] items-center gap-3";

export default async function CategoriesPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  const categories = (data ?? []) as Category[];

  return (
    <div>
      <PageHeader title={S.categoriesTitle} subtitle={`${categories.length} ${S.results}`} />

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
          <div className="min-w-[900px] p-3">
            <div className={`${ROW_GRID} border-b border-[#ece5dd] px-2 pb-2 text-xs font-semibold text-[#8a7a6d]`}>
              <div>{S.colIcon}</div>
              <div>{S.colNameAr}</div>
              <div>{S.colNameHe}</div>
              <div>{S.colSlug}</div>
              <div>{S.colSort}</div>
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
                <input name="icon" defaultValue={c.icon} className="input" dir="ltr" title={S.iconHint} />
                <input name="name_ar" defaultValue={c.name_ar} required className="input" />
                <input name="name_he" defaultValue={c.name_he} required className="input" dir="rtl" />
                <div className="truncate font-mono text-xs text-[#8a7a6d]" dir="ltr" title={c.slug}>
                  {c.slug}
                </div>
                <input name="sort_order" type="number" defaultValue={c.sort_order} className="input" dir="ltr" />
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
