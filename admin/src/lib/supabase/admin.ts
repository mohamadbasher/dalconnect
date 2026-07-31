import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — SERVER ONLY. Bypasses RLS.
 * Only ever call this from server actions / server components that have
 * already verified the caller is an admin (see requireAdmin()).
 */
export function createAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-key";

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
