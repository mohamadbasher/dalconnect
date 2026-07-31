import type { BookingStatus } from "./types";

export { CURRENCY, formatPrice } from "./theme";

/** relative-ish timestamp for lists */
export function formatTime(iso: string, lang: "ar" | "he"): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return lang === "ar" ? "الآن" : "עכשיו";
  if (mins < 60) return lang === "ar" ? `قبل ${mins} د` : `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === "ar" ? `قبل ${hours} س` : `לפני ${hours} ש׳`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(lang === "ar" ? "ar" : "he-IL", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatDateTime(iso: string, lang: "ar" | "he"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "ar" ? "ar" : "he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_KEY: Record<BookingStatus, string> = {
  open: "statusOpen",
  pending: "statusPending",
  accepted: "statusAccepted",
  on_the_way: "statusOnTheWay",
  in_progress: "statusInProgress",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  rejected: "statusRejected",
  rated: "statusRated",
};

/** tone used by <Badge> for each booking status */
export const STATUS_TONE: Record<BookingStatus, "neutral" | "brand" | "success" | "danger" | "gold" | "info"> = {
  open: "gold",
  pending: "gold",
  accepted: "info",
  on_the_way: "info",
  in_progress: "brand",
  completed: "success",
  cancelled: "danger",
  rejected: "danger",
  rated: "success",
};

export function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

export function isValidIsraeliPhone(p: string): boolean {
  const d = normalizePhone(p);
  return /^05\d{8}$/.test(d) || /^9725\d{8}$/.test(d);
}
