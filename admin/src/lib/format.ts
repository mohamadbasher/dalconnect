export function formatPrice(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `₪${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
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
