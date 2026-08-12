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

// ---------------------------------------------------------------------------
// Phone numbers
//
// The phone number is the account identifier AND the thing customers pay to
// reach, so it is normalised to one canonical local form (05XXXXXXXX) before it
// ever touches the database. Today only Israeli mobiles are accepted; the
// helpers below are the single place to widen that later.
// ---------------------------------------------------------------------------

/** Digits only — drops spaces, dashes, brackets and any pasted formatting. */
export function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

/**
 * Canonical local form for storage/login: `05XXXXXXXX`.
 * Accepts what people actually paste — `+972 50-123-4567`, `00972...`,
 * `972...` — and folds it all to the same 10 digits.
 */
export function canonicalIsraeliPhone(p: string): string {
  let d = normalizePhone(p);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("972")) d = `0${d.slice(3)}`;
  return d;
}

/** What to allow while the user is typing: digits, optional single leading +. */
export function sanitizePhoneInput(raw: string): string {
  const plus = raw.trimStart().startsWith("+");
  const digits = normalizePhone(raw).slice(0, plus ? 15 : 10);
  return plus ? `+${digits}` : digits;
}

export function isValidIsraeliPhone(p: string): boolean {
  return /^05\d{8}$/.test(canonicalIsraeliPhone(p));
}

/**
 * The provider's six-digit login number as it should appear WHILE typing.
 *
 * An Israeli mobile is exactly 10 digits (05X XXXXXXX), so the number is
 * positions 5-10 — it starts filling the moment the 5th digit is entered and
 * is complete at the 10th. Any country code (+972 / 00972) is folded away
 * first, so it never counts toward those positions.
 *
 *   05          -> ""
 *   05246       -> "6"
 *   0524604602  -> "604602"
 *   +972524604602 -> "604602"
 */
export function providerNoPreview(phone: string): string {
  return canonicalIsraeliPhone(phone).slice(4, 10);
}

/**
 * Why a number was rejected, so the field can say something more useful than
 * "invalid". Returns null when the number is fine.
 */
export type PhoneProblem = "required" | "notDigits" | "tooShort" | "tooLong" | "badPrefix";

export function phoneProblem(raw: string): PhoneProblem | null {
  const trimmed = raw.trim();
  if (!trimmed) return "required";
  // anything that isn't a digit, +, space, dash or bracket is a typo (letters)
  if (/[^\d+\s()-]/.test(trimmed)) return "notDigits";
  const d = canonicalIsraeliPhone(trimmed);
  if (!d) return "required";
  if (d.length < 10) return "tooShort";
  if (d.length > 10) return "tooLong";
  if (!/^05/.test(d)) return "badPrefix";
  return /^05\d{8}$/.test(d) ? null : "badPrefix";
}
