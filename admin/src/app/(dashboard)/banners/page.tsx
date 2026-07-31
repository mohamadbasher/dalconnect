import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ActiveBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { addBanner, deleteBanner, toggleBanner, updateBannerSort } from "./actions";
import type { Banner } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BannersPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const banners = (data ?? []) as Banner[];

  return (
    <div>
      <PageHeader title={S.bannersTitle} subtitle={`${banners.length} ${S.results}`} />

      {/* Add form */}
      <form action={addBanner} className="card mb-5 p-4">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-brand-600" />
          {S.addBanner}
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a7a6d]">
              {S.bannerImage}
            </label>
            <input
              name="image"
              type="file"
              accept="image/*"
              required
              className="input !p-1.5 text-xs file:me-2 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a7a6d]">
              {S.colTitle} ({S.optional})
            </label>
            <input name="title" placeholder={S.colTitle} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a7a6d]">
              {S.colLink} ({S.optional})
            </label>
            <input name="link" placeholder="https://…" className="input" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a7a6d]">
              {S.colSort}
            </label>
            <input name="sort_order" type="number" defaultValue={0} className="input" dir="ltr" />
          </div>
        </div>
        <div className="mt-3">
          <SubmitButton label={`⬆ ${S.upload}`} pendingLabel={S.loading} />
        </div>
      </form>

      {/* Banner cards */}
      {banners.length === 0 ? (
        <div className="card">
          <EmptyState icon="🖼️" title={S.bannersEmpty} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {banners.map((b) => (
            <div key={b.id} className={`card overflow-hidden ${b.is_active ? "" : "opacity-70"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.image_url}
                alt={b.title || "banner"}
                className="h-36 w-full border-b border-[#ece5dd] object-cover"
              />
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-bold">{b.title || S.none}</div>
                  <ActiveBadge active={b.is_active} />
                </div>
                {b.link && (
                  <a
                    href={b.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-xs text-brand-600 hover:underline"
                    dir="ltr"
                  >
                    {b.link}
                  </a>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <form action={updateBannerSort} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={b.id} />
                    <input
                      name="sort_order"
                      type="number"
                      defaultValue={b.sort_order}
                      className="input !w-16 !px-2 !py-1.5 text-xs"
                      dir="ltr"
                      title={S.colSort}
                    />
                    <SubmitButton label={S.save} className="btn-outline !px-2.5 !py-1.5 text-xs" />
                  </form>
                  <form action={toggleBanner}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="is_active" value={String(b.is_active)} />
                    <button type="submit" className="btn-outline !px-2.5 !py-1.5 text-xs">
                      {b.is_active ? S.deactivate : S.activate}
                    </button>
                  </form>
                  <form action={deleteBanner} className="ms-auto">
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="image_url" value={b.image_url} />
                    <button type="submit" className="btn-danger !px-2.5 !py-1.5 text-xs">
                      {S.delete}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
