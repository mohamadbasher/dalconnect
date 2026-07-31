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
