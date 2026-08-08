// Contact reveal. The professional's phone number is the thing customers pay
// for, so it is never embedded in list payloads — it is fetched on demand from
// an RPC that checks the caller is a party to an ACCEPTED booking.
import { Linking, Platform } from "react-native";
import { supabase } from "./supabase";

/**
 * The other party's phone for this booking, or null while the request is still
 * open / the caller isn't entitled to it.
 */
export async function fetchContactPhone(bookingId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_contact_phone", { p_booking_id: bookingId });
  if (error) return null;
  return (data as string | null) || null;
}

/** Israeli local number -> international digits for wa.me / tel: links. */
export function toInternational(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("972")) return d;
  if (d.startsWith("0")) return `972${d.slice(1)}`;
  return `972${d}`;
}

export async function callPhone(phone: string): Promise<boolean> {
  const url = `${Platform.OS === "ios" ? "telprompt" : "tel"}:${phone}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function openWhatsApp(phone: string, message?: string): Promise<boolean> {
  const digits = toInternational(phone);
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  try {
    const appUrl = `whatsapp://send?phone=${digits}${message ? `&text=${encodeURIComponent(message)}` : ""}`;
    if (await Linking.canOpenURL(appUrl)) {
      await Linking.openURL(appUrl);
      return true;
    }
  } catch {
    // fall through to the web link
  }
  try {
    await Linking.openURL(`https://wa.me/${digits}${text}`);
    return true;
  } catch {
    return false;
  }
}
