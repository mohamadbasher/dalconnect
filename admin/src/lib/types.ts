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
