// Lightweight row types matching supabase/migrations/20260714000001_init.sql

export type UserRole = "customer" | "professional" | "admin";
export type VerificationStatus = "none" | "pending" | "approved" | "rejected";
export type BookingStatus =
  | "open"
  | "pending"
  | "accepted"
  | "on_the_way"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "rejected"
  | "rated";
export type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type ReportStatus = "open" | "in_review" | "resolved" | "dismissed";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  city_id: number | null;
  lang: string;
  is_banned: boolean;
  created_at: string;
};

export type City = {
  id: number;
  name_ar: string;
  name_he: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
};

export type Category = {
  id: number;
  slug: string;
  name_ar: string;
  name_he: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  // Leads the customer home screen ("most requested"), in popular_sort order.
  is_popular: boolean;
  popular_sort: number;
};

export type Banner = {
  id: string;
  image_url: string;
  title: string;
  link: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

// --- 20260714000004_bilingual_and_admin.sql ---

/** The four keys the `legal_pages` CHECK constraint allows. */
export type LegalPageKey = "terms" | "privacy" | "about" | "contact";

export type LegalPage = {
  key: LegalPageKey;
  title_ar: string;
  title_he: string;
  body_ar: string;
  body_he: string;
  updated_at: string;
};

export type ReviewStatus = "published" | "hidden";

export type AuditLog = {
  id: string;
  actor_id: string | null;
  /** Snapshotted at write time — see the note in the audit page. */
  actor_name: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

// --- 20260714000005_request_quote_model.sql (request & quote model) ---

/**
 * How urgently the customer needs the job. Chosen when the request is posted
 * and never changed afterwards — `same_day` costs the customer more.
 */
export type BookingUrgency = "same_day" | "scheduled";

/**
 * The money columns on `bookings` under the request/quote model.
 *
 * - `service_fee` — what the customer paid to post the request. Stamped by the
 *   `set_request_fee` trigger at INSERT from the current price list, so it is a
 *   snapshot: editing the fees in /settings never rewrites past requests.
 * - `price_min`/`price_max` — the accepted quote's range, copied from the offer.
 * - `final_price` — what was actually charged; commission is computed from it.
 * - `price` — legacy single price, kept only for rows created before the model
 *   change. Never surface it on its own.
 */
export type BookingMoney = {
  service_fee: number | null;
  price_min: number | null;
  price_max: number | null;
  final_price: number | null;
  /** @deprecated legacy pre-quote column */
  price: number | null;
  commission: number | null;
};

/** A professional's quote on a request. `price` is the legacy single value. */
export type OfferQuote = {
  price_min: number | null;
  price_max: number | null;
  /** @deprecated legacy pre-range column */
  price: number | null;
  eta_minutes: number | null;
  message: string;
  status: OfferStatus;
};

/** `app_settings` keys this panel edits. Values are stored as bare JSON numbers. */
export type NumericSettingKey = "commission_rate" | "fee_same_day" | "fee_scheduled";
