import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Phone-first auth without SMS costs (Dal/AutoHub pattern):
// users sign in with phone + password; phone maps to a synthetic email.
export function phoneToEmail(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return `${digits}@phone.dalconnect.app`;
}
