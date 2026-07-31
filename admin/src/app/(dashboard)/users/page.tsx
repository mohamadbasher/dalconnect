import { S } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { RoleBadge } from "@/components/StatusBadge";
import { toggleBan } from "./actions";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  is_banned: boolean;
  created_at: string;
  city: { name_ar: string } | null;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const db = createAdminClient();

  let query = db
    .from("profiles")
    .select("id, full_name, phone, role, is_banned, created_at, city:cities(name_ar)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q?.trim()) {
    const term = q.trim().replaceAll(",", " ");
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  const { data } = await query;
  const users = (data ?? []) as unknown as UserRow[];

  return (
    <div>
      <PageHeader title={S.usersTitle} subtitle={`${users.length} ${S.results}`}>
        <SearchInput placeholder={S.searchUsers} />
      </PageHeader>

      <div className="card overflow-hidden">
        {users.length === 0 ? (
          <EmptyState icon="👥" title={S.usersEmpty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{S.colName}</th>
                  <th>{S.colPhone}</th>
                  <th>{S.colRole}</th>
                  <th>{S.colCity}</th>
                  <th>{S.colBanned}</th>
                  <th>{S.colCreated}</th>
                  <th>{S.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.is_banned ? "opacity-60" : ""}>
                    <td className="font-semibold">{u.full_name || S.none}</td>
                    <td dir="ltr" className="text-end font-mono text-xs">
                      {u.phone || S.none}
                    </td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td>{u.city?.name_ar || S.none}</td>
                    <td>
                      {u.is_banned ? (
                        <span className="badge border border-red-200 bg-red-50 text-red-700">
                          {S.yes}
                        </span>
                      ) : (
                        <span className="text-xs text-[#8a7a6d]">{S.no}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-[#8a7a6d]">
                      {formatDate(u.created_at)}
                    </td>
                    <td>
                      {u.role !== "admin" && (
                        <form action={toggleBan}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="banned" value={String(u.is_banned)} />
                          <button
                            type="submit"
                            className={u.is_banned ? "btn-success" : "btn-danger"}
                          >
                            {u.is_banned ? S.unban : S.ban}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
