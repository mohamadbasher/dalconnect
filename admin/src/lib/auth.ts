import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Mirrors the mobile app: phone sign-ins use synthetic emails. */
export function identifierToEmail(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  const digits = trimmed.replace(/\D/g, "");
  return `${digits}@phone.dalconnect.app`;
}

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
};

/**
 * Returns the signed-in admin, or null if not signed in / not an admin.
 * Uses the cookie client (RLS: profiles are publicly readable).
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return null;
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name ?? "",
  };
}

/**
 * Guard for server actions — every mutation must call this before touching
 * the service-role client. Redirects to /login when the caller is not admin.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) redirect("/login?error=not_admin");
  return admin;
}
