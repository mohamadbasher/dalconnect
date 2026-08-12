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

// ---------------------------------------------------------------------------
// Login identity
//
// Supabase Auth needs a globally unique email per account, but one person may
// hold BOTH a customer and a provider account on the same phone. So each role
// gets its own synthetic address:
//
//   customer  ->  <phone>@phone.dalconnect.app    (0521234567@phone…)
//   provider  ->  <provider_no>@pro.dalconnect.app (234567@pro…)
//
// A provider's six-digit number is the local part, so uniqueness is enforced by
// Auth itself, and a 6-digit login can never be mistaken for a 10-digit phone.
// ---------------------------------------------------------------------------

export const CUSTOMER_EMAIL_DOMAIN = "phone.dalconnect.app";
export const PROVIDER_EMAIL_DOMAIN = "pro.dalconnect.app";

/** A six-digit provider login ID (never a phone — Israeli mobiles are 10). */
export function looksLikeProviderNo(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

export function phoneToEmail(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return `${digits}@${CUSTOMER_EMAIL_DOMAIN}`;
}

export function providerNoToEmail(providerNo: string): string {
  return `${providerNo.trim().replace(/\D/g, "")}@${PROVIDER_EMAIL_DOMAIN}`;
}

/**
 * Resolve whatever the user typed into the address to authenticate with.
 * Six digits => provider; anything else => customer phone (or a raw email).
 */
export function identifierToEmail(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) return trimmed;
  return looksLikeProviderNo(trimmed) ? providerNoToEmail(trimmed) : phoneToEmail(trimmed);
}
