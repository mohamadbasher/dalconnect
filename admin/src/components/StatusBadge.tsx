import { S } from "@/lib/strings";
import type {
  BookingStatus,
  OfferStatus,
  ReportStatus,
  ReviewStatus,
  UserRole,
  VerificationStatus,
} from "@/lib/types";

const BOOKING_STYLES: Record<BookingStatus, string> = {
  open: "bg-sky-50 text-sky-700 border border-sky-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  accepted: "bg-teal-50 text-teal-700 border border-teal-200",
  on_the_way: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  in_progress: "bg-violet-50 text-violet-700 border border-violet-200",
  completed: "bg-green-50 text-green-700 border border-green-200",
  cancelled: "bg-stone-100 text-stone-600 border border-stone-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  rated: "bg-yellow-50 text-yellow-700 border border-yellow-300",
};

const BOOKING_LABELS: Record<BookingStatus, string> = {
  open: S.statusOpen,
  pending: S.statusPending,
  accepted: S.statusAccepted,
  on_the_way: S.statusOnTheWay,
  in_progress: S.statusInProgress,
  completed: S.statusCompleted,
  cancelled: S.statusCancelled,
  rejected: S.statusRejected,
  rated: S.statusRated,
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`badge ${BOOKING_STYLES[status] ?? BOOKING_STYLES.cancelled}`}>
      {BOOKING_LABELS[status] ?? status}
    </span>
  );
}

const ROLE_STYLES: Record<UserRole, string> = {
  customer: "bg-sky-50 text-sky-700 border border-sky-200",
  professional: "bg-brand-50 text-brand-700 border border-brand-200",
  admin: "bg-violet-50 text-violet-700 border border-violet-200",
};

const ROLE_LABELS: Record<UserRole, string> = {
  customer: S.roleCustomer,
  professional: S.roleProfessional,
  admin: S.roleAdmin,
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`badge ${ROLE_STYLES[role] ?? ROLE_STYLES.customer}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

const VERIFICATION_STYLES: Record<VerificationStatus, string> = {
  none: "bg-stone-100 text-stone-600 border border-stone-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-green-50 text-green-700 border border-green-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
};

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  none: S.verNone,
  pending: S.verPending,
  approved: S.verApproved,
  rejected: S.verRejected,
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span className={`badge ${VERIFICATION_STYLES[status] ?? VERIFICATION_STYLES.none}`}>
      {status === "approved" ? "✓ " : ""}
      {VERIFICATION_LABELS[status] ?? status}
    </span>
  );
}

const REPORT_STYLES: Record<ReportStatus, string> = {
  open: "bg-red-50 text-red-700 border border-red-200",
  in_review: "bg-amber-50 text-amber-700 border border-amber-200",
  resolved: "bg-green-50 text-green-700 border border-green-200",
  dismissed: "bg-stone-100 text-stone-600 border border-stone-200",
};

export const REPORT_LABELS: Record<ReportStatus, string> = {
  open: S.reportOpen,
  in_review: S.reportInReview,
  resolved: S.reportResolved,
  dismissed: S.reportDismissed,
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`badge ${REPORT_STYLES[status] ?? REPORT_STYLES.open}`}>
      {REPORT_LABELS[status] ?? status}
    </span>
  );
}

const OFFER_STYLES: Record<OfferStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  accepted: "bg-green-50 text-green-700 border border-green-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  withdrawn: "bg-stone-100 text-stone-600 border border-stone-200",
};

const OFFER_LABELS: Record<OfferStatus, string> = {
  pending: S.offerPending,
  accepted: S.offerAccepted,
  rejected: S.offerRejected,
  withdrawn: S.offerWithdrawn,
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return (
    <span className={`badge ${OFFER_STYLES[status] ?? OFFER_STYLES.pending}`}>
      {OFFER_LABELS[status] ?? status}
    </span>
  );
}

const REVIEW_STYLES: Record<ReviewStatus, string> = {
  published: "bg-green-50 text-green-700 border border-green-200",
  hidden: "bg-stone-100 text-stone-600 border border-stone-200",
};

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  published: S.reviewPublished,
  hidden: S.reviewHidden,
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`badge ${REVIEW_STYLES[status] ?? REVIEW_STYLES.published}`}>
      {status === "hidden" ? "🚫 " : ""}
      {REVIEW_LABELS[status] ?? status}
    </span>
  );
}

/**
 * Audit rows store the role as free text snapshotted at write time, so it can
 * hold a value that is no longer a valid UserRole (or an empty string).
 */
export function ActorRoleBadge({ role }: { role: string }) {
  const known = ROLE_LABELS[role as UserRole];
  if (known) return <RoleBadge role={role as UserRole} />;
  return (
    <span className="badge border border-stone-200 bg-stone-100 text-stone-600">
      {role || S.none}
    </span>
  );
}

export type FeaturedState = "active" | "expired" | "off";

export function FeaturedBadge({ state }: { state: FeaturedState }) {
  if (state === "off") return <span className="text-xs text-[#8a7a6d]">{S.none}</span>;
  return (
    <span
      className={`badge ${
        state === "active"
          ? "border border-amber-300 bg-amber-50 text-amber-700"
          : "border border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {state === "active" ? `★ ${S.featuredActiveBadge}` : `⌛ ${S.featuredExpiredBadge}`}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`badge ${
        active
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-stone-100 text-stone-600 border border-stone-200"
      }`}
    >
      {active ? S.active : S.inactive}
    </span>
  );
}
