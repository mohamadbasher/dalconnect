// Turning a structured saved address back into one line.
//
// This lives in the app rather than in a database trigger because the labels
// ("קומה", "دور") are language-dependent, and the two languages this app speaks
// would have to be hard-coded into SQL otherwise. The parts are the source of
// truth; this is only presentation.
import type { SavedAddress } from "./types";

type Labels = { floor: string; apartment: string };

/**
 * "רחוב הרצל 12, קומה 3, דירה 5"
 *
 * Skips whatever is missing rather than leaving empty fragments, so a
 * half-filled address still reads as a sentence. Falls back to the legacy
 * free-text `address` for rows saved before the fields were split out.
 */
export function formatAddress(a: Partial<SavedAddress>, labels: Labels): string {
  const streetLine = [a.street?.trim(), a.house_number?.trim()].filter(Boolean).join(" ");
  const parts = [
    streetLine,
    a.floor?.trim() ? `${labels.floor} ${a.floor.trim()}` : null,
    a.apartment?.trim() ? `${labels.apartment} ${a.apartment.trim()}` : null,
  ].filter(Boolean);

  if (parts.length > 0) return parts.join(", ");
  return (a.address ?? "").trim();
}

/** City first, then the street line — how you'd say it out loud. */
export function formatFullAddress(
  a: Partial<SavedAddress>,
  cityName: string | null,
  labels: Labels
): string {
  return [cityName, formatAddress(a, labels)].filter(Boolean).join(" · ");
}
