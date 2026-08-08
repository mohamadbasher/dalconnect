export function formatPrice(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `₪${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** PostgREST hands numerics back as numbers or strings depending on the driver. */
function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Money that only means something once it has a real value: null, an unparsable
 * value and 0 all render as "—". Used for `final_price` and `service_fee`, which
 * sit at 0/null until the job is done / the owner sets the request price list —
 * a bare "₪0" there would read as "this job was free".
 */
export function formatAmount(v: number | string | null | undefined): string {
  const n = toNumber(v);
  return n === null || n === 0 ? "—" : formatPrice(n);
}

/**
 * A quote's price range — "₪120 – ₪180", collapsed to a single figure when both
 * ends match, and "—" when neither end is set. Render it inside dir="ltr" so the
 * dash does not flip between the two figures in the RTL layout.
 */
export function formatPriceRange(
  min: number | string | null | undefined,
  max: number | string | null | undefined,
): string {
  const lo = toNumber(min);
  const hi = toNumber(max);
  if (lo === null && hi === null) return "—";
  if (lo === null) return formatPrice(hi);
  if (hi === null) return formatPrice(lo);
  if (lo === hi) return formatPrice(lo);
  return `${formatPrice(lo)} – ${formatPrice(hi)}`;
}

/**
 * What a request is worth right now: the agreed final price once it exists,
 * otherwise the accepted quote's range, otherwise "—". Never falls back to the
 * legacy `price` column on its own.
 */
export function formatFinalOrRange(
  final: number | string | null | undefined,
  min: number | string | null | undefined,
  max: number | string | null | undefined,
): string {
  const f = toNumber(final);
  if (f !== null && f > 0) return formatPrice(f);
  return formatPriceRange(min, max);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ar", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ar", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Absolute timestamp including the year — used by the audit log. */
export function formatDateTimeFull(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ar", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "قبل 3 ساعات" — negative diffs read as past, positive as future. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diff)) return "—";
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 1000), "second");
}

/** Whole days remaining until `iso` (0 once it is in the past). */
export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const diff = new Date(iso).getTime() - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / 86_400_000);
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
