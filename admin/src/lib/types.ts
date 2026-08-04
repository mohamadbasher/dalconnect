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
