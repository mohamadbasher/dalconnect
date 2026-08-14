// Cached reference data (categories, cities) — AutoHub pattern.
import { supabase } from "./supabase";
import type { Category, City } from "./types";

let categoriesCache: Category[] | null = null;
let citiesCache: City[] | null = null;

export async function fetchCategories(force = false): Promise<Category[]> {
  if (categoriesCache && !force) return categoriesCache;
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  categoriesCache = (data as Category[]) ?? [];
  return categoriesCache;
}

export async function fetchCities(force = false): Promise<City[]> {
  if (citiesCache && !force) return citiesCache;
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .eq("is_active", true)
    .order("name_ar");
  if (error) throw error;
  citiesCache = (data as City[]) ?? [];
  return citiesCache;
}

/**
 * The trades that lead the home screen when the database hasn't been told yet.
 *
 * `categories.is_popular` is the real source — it lets the admin curate this
 * without an app release — but the app must still show a sensible short list
 * before that migration is applied, and if someone un-flags everything.
 */
const POPULAR_FALLBACK = [
  "electrician",
  "plumber",
  "ac",
  "cleaning",
  "car-wash",
  "carpenter",
  "painter",
  "gardening",
];

/** The curated "most requested" set, in display order. */
export function popularCategories(all: Category[]): Category[] {
  const flagged = all
    .filter((c) => c.is_popular)
    .sort((a, b) => (a.popular_sort ?? 0) - (b.popular_sort ?? 0));
  if (flagged.length > 0) return flagged;

  const bySlug = new Map(all.map((c) => [c.slug, c]));
  return POPULAR_FALLBACK.map((slug) => bySlug.get(slug)).filter((c): c is Category => Boolean(c));
}
