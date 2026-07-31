import { redirect } from "next/navigation";
import { S } from "@/lib/strings";
import { getAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SideNav } from "@/components/SideNav";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) {
    // Signed in but not an admin (middleware already handles signed-out):
    // sign them out so they land on the login form with a clear message.
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?error=not_admin");
  }

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      {/* Sidebar (right side in RTL) */}
      <aside className="sticky top-0 flex h-screen flex-col border-s border-[#ece5dd] bg-white px-3 py-5">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white">
            د
          </div>
          <div className="text-[13px] font-bold leading-tight">{S.appName}</div>
        </div>
        <SideNav />
        <div className="mt-auto border-t border-[#ece5dd] pt-3">
          <div
            className="truncate px-2 pb-2 text-[11px] text-[#8a7a6d]"
            title={admin.email}
          >
            {S.signedInAs}: {admin.fullName || admin.email}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-start text-sm font-medium text-[#b3362b] transition hover:bg-red-50"
            >
              ⎋ {S.signOut}
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 bg-[#faf7f4] px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
