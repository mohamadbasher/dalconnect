// Row types mirroring supabase/migrations — keep in sync with the schema.

export type UserRole = "customer" | "professional" | "admin";
export type VerificationStatus = "none" | "pending" | "approved" | "rejected";
export type BookingType = "direct" | "open";
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

export interface Category {
  id: number;
  slug: string;
  name_ar: string;
  name_he: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
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

export interface Offer {
  id: string;
  booking_id: string;
  professional_id: string;
  price: number;
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
  title: string;
  body: string;
  data: { bookingId?: string; conversationId?: string; offerId?: string };
  is_read: boolean;
  created_at: string;
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
