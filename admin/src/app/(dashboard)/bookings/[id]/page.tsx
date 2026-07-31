import Link from "next/link";
import { notFound } from "next/navigation";
import { S, fmt } from "@/lib/strings";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, formatPrice, shortId } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { BookingStatusBadge, OfferStatusBadge } from "@/components/StatusBadge";
import { adminCancelBooking } from "../actions";
import type { BookingStatus, OfferStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type BookingDetail = {
  id: string;
  type: "direct" | "open";
  status: BookingStatus;
  title: string;
  description: string;
  photos: string[];
  address: string;
  scheduled_at: string | null;
  price: number | null;
  commission: number | null;
  cancel_reason: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  customer: { id: string; full_name: string; phone: string } | null;
  professional: {
    business_name: string;
    profile: { full_name: string; phone: string } | null;
  } | null;
  category: { name_ar: string } | null;
  city: { name_ar: string } | null;
};

type OfferRow = {
  id: string;
  price: number;
  eta_minutes: number | null;
  message: string;
  status: OfferStatus;
  created_at: string;
  professional: { business_name: string } | null;
};

const CANCELLABLE: BookingStatus[] = [
  "open",
  "pending",
  "accepted",
  "on_the_way",
  "in_progress",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-[#8a7a6d]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{children}</div>
    </div>
  );
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = createAdminClient();

  const [bookingRes, offersRes] = await Promise.all([
    db
      .from("bookings")
      .select(
        `id, type, status, title, description, photos, address, scheduled_at,
         price, commission, cancel_reason, created_at, accepted_at, completed_at,
         customer:profiles!bookings_customer_id_fkey(id, full_name, phone),
         professional:professionals!bookings_professional_id_fkey(
           business_name, profile:profiles!professionals_id_fkey(full_name, phone)),
         category:categories(name_ar),
         city:cities(name_ar)`,
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("offers")
      .select(
        `id, price, eta_minutes, message, status, created_at,
         professional:professionals(business_name)`,
      )
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const booking = bookingRes.data as unknown as BookingDetail | null;
  if (!booking) notFound();

  const offers = (offersRes.data ?? []) as unknown as OfferRow[];

  return (
    <div>
      <Link
        href="/bookings"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
      >
        → {S.backToBookings}
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold">
            {S.bookingDetails}{" "}
            <span className="font-mono text-base text-[#8a7a6d]" dir="ltr">
              {shortId(booking.id)}
            </span>
          </h1>
          <BookingStatusBadge status={booking.status} />
        </div>
        {CANCELLABLE.includes(booking.status) && (
          <form action={adminCancelBooking}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <button type="submit" className="btn-danger">
              ✗ {S.adminCancel}
            </button>
          </form>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          {/* Main info */}
          <section className="card p-5">
            {booking.title && (
              <h2 className="mb-3 text-lg font-bold">{booking.title}</h2>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label={S.colCustomer}>
                {booking.customer?.full_name || S.none}
                {booking.customer?.phone && (
                  <span className="block font-mono text-xs text-[#8a7a6d]" dir="ltr">
                    {booking.customer.phone}
                  </span>
                )}
              </Field>
              <Field label={S.colProfessional}>
                {booking.professional?.business_name || S.none}
                {booking.professional?.profile?.phone && (
                  <span className="block font-mono text-xs text-[#8a7a6d]" dir="ltr">
                    {booking.professional.profile.phone}
                  </span>
                )}
              </Field>
              <Field label={S.colCategory}>{booking.category?.name_ar || S.none}</Field>
              <Field label={S.colCity}>{booking.city?.name_ar || S.none}</Field>
              <Field label={S.address}>{booking.address || S.none}</Field>
              <Field label={S.scheduledAt}>
                {booking.scheduled_at ? formatDateTime(booking.scheduled_at) : S.asap}
              </Field>
              <Field label={S.colPrice}>{formatPrice(booking.price)}</Field>
              <Field label={S.colCommission}>{formatPrice(booking.commission)}</Field>
              <Field label={S.colCreated}>{formatDateTime(booking.created_at)}</Field>
            </div>

            <div className="mt-4 border-t border-[#f3eee8] pt-4">
              <div className="mb-1 text-xs font-medium text-[#8a7a6d]">{S.description}</div>
              <p className="whitespace-pre-wrap text-sm leading-6">
                {booking.description || S.none}
              </p>
            </div>

            {booking.cancel_reason && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {S.statusCancelled}: {booking.cancel_reason}
              </div>
            )}
          </section>

          {/* Photos */}
          <section className="card p-5">
            <h2 className="section-title mb-3 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-brand-600" />
              {S.photos}
            </h2>
            {booking.photos.length === 0 ? (
              <p className="text-sm text-[#8a7a6d]">{S.noPhotos}</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {booking.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`صورة ${i + 1}`}
                      className="h-28 w-28 rounded-xl border border-[#ece5dd] object-cover transition hover:opacity-90"
                    />
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Offers */}
        <section className="card self-start overflow-hidden">
          <div className="border-b border-[#ece5dd] px-4 py-3">
            <h2 className="section-title flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-brand-600" />
              {S.offers}
              <span className="text-xs font-medium text-[#8a7a6d]">({offers.length})</span>
            </h2>
          </div>
          {offers.length === 0 ? (
            <EmptyState icon="💬" title={S.noOffers} />
          ) : (
            <ul className="divide-y divide-[#f3eee8]">
              {offers.map((o) => (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold">
                      {o.professional?.business_name || S.none}
                    </div>
                    <OfferStatusBadge status={o.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[#8a7a6d]">
                    <span className="font-bold text-brand-700">{formatPrice(o.price)}</span>
                    {o.eta_minutes !== null && (
                      <span>{fmt(S.offerEta, { m: o.eta_minutes })}</span>
                    )}
                    <span>{formatDateTime(o.created_at)}</span>
                  </div>
                  {o.message && (
                    <p className="mt-1.5 rounded-lg bg-[#faf7f4] px-3 py-2 text-xs leading-5">
                      {o.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
