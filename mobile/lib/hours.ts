// Working-hours + time-slot helpers (ported from Dal's src/hours.ts and adapted
// to our schema): `professionals.working_hours` is a jsonb object keyed "0".."6"
// (0 = Sunday) whose values are {from,to} in "HH:mm", or null for a closed day.
import type { Lang } from "./types";

export type DayRange = { from: string; to: string };
export type WorkingHours = Record<string, DayRange | null> | null | undefined;

/** "00:00", "00:30", … "23:30" — the half-hour grid used by the booking picker. */
export const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const HHMM = /^(\d{1,2}):([0-5]\d)$/;

/** "HH:mm" → minutes since midnight, or null when the value is unusable. */
export function minutesOf(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = HHMM.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return h * 60 + Number(m[2]);
}

/** The {from,to} range for a weekday (0 = Sunday), or null when closed/invalid. */
export function dayRange(hours: WorkingHours, day: number): DayRange | null {
  if (!hours) return null;
  const r = hours[String(day)];
  if (!r) return null;
  if (minutesOf(r.from) === null || minutesOf(r.to) === null) return null;
  return r;
}

/** True when the professional publishes any working day at all. */
export function hasWorkingHours(hours: WorkingHours): boolean {
  if (!hours) return false;
  for (let d = 0; d < 7; d++) if (dayRange(hours, d)) return true;
  return false;
}

/**
 * One-line "today" label: "اليوم 09:00 – 21:00" / "היום 09:00 – 21:00",
 * the closed variant when today is off, or null when no hours are published
 * at all (so callers can hide the row entirely).
 */
export function todayHoursLabel(hours: WorkingHours, lang: Lang): string | null {
  if (!hasWorkingHours(hours)) return null;
  const range = dayRange(hours, new Date().getDay());
  if (!range) return lang === "ar" ? "مغلق اليوم" : "סגור היום";
  const today = lang === "ar" ? "اليوم" : "היום";
  return `${today} ${range.from} – ${range.to}`;
}

/** Is the professional inside their published hours right now? (handles past-midnight ranges) */
export function isOpenNow(hours: WorkingHours, at: Date = new Date()): boolean {
  if (!hours) return false;
  const now = at.getHours() * 60 + at.getMinutes();

  const today = dayRange(hours, at.getDay());
  if (today) {
    const from = minutesOf(today.from) ?? 0;
    const to = minutesOf(today.to) ?? 0;
    // normal range 09:00–21:00, or an overnight range still running (22:00–02:00)
    if (from < to ? now >= from && now < to : from > to ? now >= from : false) return true;
  }

  // an overnight range that started yesterday may still be open after midnight
  const yesterday = dayRange(hours, (at.getDay() + 6) % 7);
  if (yesterday) {
    const from = minutesOf(yesterday.from) ?? 0;
    const to = minutesOf(yesterday.to) ?? 0;
    if (from > to && now < to) return true;
  }
  return false;
}
