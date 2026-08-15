// Row types mirroring supabase/migrations — keep in sync with the schema.

export type UserRole = "customer" | "professional" | "admin";
export type VerificationStatus = "none" | "pending" | "approved" | "rejected";
export type BookingType = "direct" | "open";
/** same_day costs the customer more than a scheduled (next-day or later) request */
export type BookingUrgency = "same_day" | "scheduled";
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
export type MessageType = "text" | "image" | "location";
export type Lang = "ar" | "he";

export interface City {
  id: number;
  name_ar: string;
  name_he: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
}

/** A place the customer orders to repeatedly — "בית", "עבודה", "בית ההורים". */
export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  city_id: number | null;
  address: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
  // joined
  city?: City | null;
}

export interface Category {
  id: number;
  slug: string;
  name_ar: string;
  name_he: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  /** Leads the customer home screen. Optional: absent until the popular-
   *  categories migration has been applied, in which case the app falls back
   *  to POPULAR_FALLBACK in lib/refdata. */
  is_popular?: boolean;
  popular_sort?: number;
}

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  city_id: number | null;
  lang: Lang;
  is_banned: boolean;
  /** granular staff powers; admins bypass this list entirely */
  permissions: string[];
  /** six-digit login ID for providers (last 6 of the phone); null for customers */
  provider_no: string | null;
  /** groundwork for SMS verification — no OTP is sent yet */
  phone_verified: boolean;
  created_at: string;
}

export interface Professional {
  id: string;
  business_name: string;
  bio: string;
  city_id: number | null;
  lat: number | null;
  lng: number | null;
  is_available: boolean;
  verification_status: VerificationStatus;
  id_document_url: string | null;
  working_hours: Record<string, { from: string; to: string } | null>;
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  /** paid placement — active only while featured_until is null or in the future */
  featured: boolean;
  featured_until: string | null;
  featured_sort: number;
  created_at: string;
}

/** professional + joined profile + categories, as most screens need it */
export interface ProCard extends Professional {
  profile?: Profile;
  categories?: Category[];
  city?: City | null;
}

export interface Booking {
  id: string;
  type: BookingType;
  status: BookingStatus;
  customer_id: string;
  professional_id: string | null;
  category_id: number;
  title: string;
  description: string;
  photos: string[];
  city_id: number | null;
  address: string;
  lat: number | null;
  lng: number | null;
  scheduled_at: string | null;
  /** how soon the customer needs it — same-day carries a higher request fee */
  urgency: BookingUrgency;
  /** platform fee for placing the request, snapshotted when it was created */
  service_fee: number;
  /** the accepted quote's range, copied from the offer on acceptance */
  price_min: number | null;
  price_max: number | null;
  /** what was actually charged, entered on completion; commission is based on it */
  final_price: number | null;
  /** legacy single price — superseded by the range, kept for old rows */
  price: number | null;
  commission: number | null;
  cancel_reason: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  // common joins
  category?: Category;
  customer?: Profile;
  professional?: Professional & { profile?: Profile };
  city?: City | null;
}

/** A quote: professionals answer a request with a price RANGE, not a fixed price. */
export interface Offer {
  id: string;
  booking_id: string;
  professional_id: string;
  price_min: number | null;
  price_max: number | null;
  /** legacy single price — kept for rows created before quotes became ranges */
  price: number | null;
  eta_minutes: number | null;
  message: string;
  status: OfferStatus;
  created_at: string;
  professional?: Professional & { profile?: Profile };
  booking?: Booking;
}

export interface Review {
  id: string;
  booking_id: string;
  customer_id: string;
  professional_id: string;
  rating: number;
  created_at: string;
  customer?: Profile;
}

export interface Transaction {
  id: string;
  professional_id: string;
  booking_id: string;
  amount: number;
  commission: number;
  net: number;
  created_at: string;
  booking?: Booking;
}

export interface Conversation {
  id: string;
  customer_id: string;
  professional_id: string;
  last_message_at: string;
  last_message_preview: string;
  customer?: Profile;
  professional?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  body: string;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  is_read: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "booking_update" | "offer" | "message" | "system" | "promo";
  /** legacy single-language columns — kept for older rows */
  title: string;
  body: string;
  /** per-language copy; prefer these and fall back to title/body */
  title_ar: string | null;
  title_he: string | null;
  body_ar: string | null;
  body_he: string | null;
  data: { bookingId?: string; conversationId?: string; offerId?: string };
  is_read: boolean;
  created_at: string;
}

/** Pick the viewer's language for a notification, falling back to legacy rows. */
export function notificationText(n: Notification, lang: Lang): { title: string; body: string } {
  return {
    title: (lang === "he" ? n.title_he : n.title_ar) || n.title || "",
    body: (lang === "he" ? n.body_he : n.body_ar) || n.body || "",
  };
}

export interface LegalPage {
  key: "terms" | "privacy" | "about" | "contact";
  title_ar: string;
  title_he: string;
  body_ar: string;
  body_he: string;
  updated_at: string;
}

export interface GalleryItem {
  id: string;
  professional_id: string;
  image_url: string;
  caption: string;
  created_at: string;
}

export interface Banner {
  id: string;
  image_url: string;
  title: string;
  link: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  booking_id: string | null;
  reason: string;
  details: string;
  status: "open" | "in_review" | "resolved" | "dismissed";
  created_at: string;
}
