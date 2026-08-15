// Booking detail — customer view of a REQUEST.
//
// The flow this screen serves: the customer posts a request, every nearby
// professional in the trade answers with a quote (a price RANGE + arrival time
// + a note), the customer compares them, accepts one — and only then does the
// professional's phone number appear so the two can settle the details by
// phone or WhatsApp.
//
// Layout follows that story rather than the data model: one small header card
// (what the job is + where it stands), then whatever matters RIGHT NOW — the
// quotes while it is open, the contact card once it is accepted — and only
// then the details the customer already knows because they typed them.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, radius, spacing, formatPrice } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { channelTopic } from "../../lib/realtime";
import { getOrCreateConversation } from "../../lib/chat";
import { callPhone, fetchContactPhone, openWhatsApp } from "../../lib/contact";
import { formatDateTime, STATUS_KEY, STATUS_TONE } from "../../lib/format";
import { PROFILE_FIELDS } from "../../lib/queries";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  InlineNote,
  Input,
  Loading,
  SectionHeader,
  StarRating,
  StatusPill,
} from "../../components/ui";
import { MONEY_TEXT, OfferCard, proDisplayName, quotePriceText } from "../../components/OfferCard";
import type { QuoteOffer } from "../../components/OfferCard";
import { RateModal } from "../../components/RateModal";
import { useToast } from "../../components/Toast";
import type { Booking, BookingStatus, Review } from "../../lib/types";

type MCIName = keyof typeof MaterialCommunityIcons.glyphMap;

/** cancelling is off the table once the pro is actually working (or the job is done) */
const CANCEL_LOCKED: BookingStatus[] = ["on_the_way", "in_progress", "completed", "rated"];

/**
 * Statuses in which the two parties have been introduced: the quote was
 * accepted, so `get_contact_phone` will hand over the number. Mirrors the
 * whitelist inside the RPC — keep them in sync.
 */
const CONTACT_UNLOCKED: BookingStatus[] = ["accepted", "on_the_way", "in_progress", "completed", "rated"];

/**
 * The five milestones of a request, right to left. These name the JOURNEY —
 * where the customer is and what comes next — which is what "1/5" left them to
 * guess. STATUS_KEY still names the current state, shown in the pill above.
 */
const TRACK_STEPS = ["trackSent", "trackOffers", "trackChosen", "trackWorking", "trackDone"] as const;

/**
 * Which milestone the request is standing on.
 *
 * "Offers" is the one milestone a status alone can't tell you: an open request
 * with nothing in it is still at "sent", and the same status with three quotes
 * waiting has genuinely moved on. Hence the count.
 */
function trackIndex(status: BookingStatus, offerCount: number): number {
  switch (status) {
    case "open":
      return offerCount > 0 ? 1 : 0;
    case "pending":
      // direct booking — no quoting round, waiting on one professional
      return 1;
    case "accepted":
      return 2;
    case "on_the_way":
    case "in_progress":
      return 3;
    case "completed":
    case "rated":
      return 4;
    default:
      return -1;
  }
}

/** cheapest first; quotes with no price at all sink to the bottom */
function quoteSortKey(o: QuoteOffer): number {
  const raw = o.price_min ?? o.price ?? o.price_max;
  if (raw === null || raw === undefined) return Number.POSITIVE_INFINITY;
  const n = typeof raw === "string" ? parseFloat(raw) : raw;
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isNaN(n) ? null : n;
}

/** subtle looping opacity pulse for the "waiting for quotes" state */
function Pulse({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

/**
 * Borderless text action. The bottom of this screen is a list of things the
 * customer will rarely want (cancel, report) — as outlined buttons they shout
 * over the job itself, so they are quiet links instead.
 */
function QuietAction({
  icon,
  label,
  color,
  onPress,
  disabled,
  small,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  /** tertiary weight — for actions that shouldn't read as peers of cancelling */
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => ({
        ...ROW,
        gap: small ? 5 : 7,
        justifyContent: "center",
        paddingVertical: small ? 6 : 10,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={small ? 13 : 16} color={color} />
      <Text style={{ color, fontSize: small ? 12 : 14, fontWeight: small ? "600" : "700" }}>{label}</Text>
    </Pressable>
  );
}

export default function BookingDetail() {
  const { colors } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [offers, setOffers] = useState<QuoteOffer[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [showDeclined, setShowDeclined] = useState(false);
  /**
   * The request body collapses only while quotes are the point of the screen.
   * Once someone is chosen there is nothing left to compare, so the details are
   * the content again and open by default. Set from the booking once it loads.
   */
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [rateVisible, setRateVisible] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [confirmDoneVisible, setConfirmDoneVisible] = useState(false);
  const [confirmingDone, setConfirmingDone] = useState(false);
  /** true only in the moment right after confirming — swaps the plain "rate"
   *  button for a fuller thank-you banner. Not persisted: reopening an already-
   *  completed job later shows the plain button, same as before. */
  const [justConfirmedDone, setJustConfirmedDone] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  // The photo strip is laid out row-reverse, so its "end" is the right edge —
  // where the first photo lives. Without this jump it opens on the last one.
  const photosRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("bookings")
      .select(
        `*, category:categories(*), city:cities(*), professional:professionals(*, profile:profiles!professionals_id_fkey(${PROFILE_FIELDS}))`
      )
      .eq("id", id)
      .maybeSingle();
    const b = (data as unknown as Booking | null) ?? null;
    setBooking(b);
    if (b?.status === "open") {
      // pending AND rejected: a declined quote is still shown (collapsed) so the
      // customer can see what they turned down rather than watching it vanish.
      const { data: offs } = await supabase
        .from("offers")
        .select(
          `*, professional:professionals(*, profile:profiles!professionals_id_fkey(${PROFILE_FIELDS}), city:cities(*))`
        )
        .eq("booking_id", id)
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: true });
      setOffers((offs as unknown as QuoteOffer[]) ?? []);
    } else {
      setOffers([]);
    }
    if (b && (b.status === "completed" || b.status === "rated")) {
      const { data: rev } = await supabase.from("reviews").select("*").eq("booking_id", id).maybeSingle();
      setReview((rev as unknown as Review | null) ?? null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // realtime: this booking row + its offers → refetch
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(channelTopic(`booking-detail-${id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `id=eq.${id}` },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers", filter: `booking_id=eq.${id}` },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const bookingStatus = booking?.status ?? null;
  const bookingProId = booking?.professional_id ?? null;
  const contactUnlocked = bookingStatus !== null && CONTACT_UNLOCKED.includes(bookingStatus);

  // Contact reveal: the number is never in the row payload, it is fetched from
  // an RPC that re-checks entitlement, so it re-runs whenever the status moves.
  useEffect(() => {
    if (!id || !contactUnlocked || !bookingProId) {
      setContactPhone(null);
      setContactLoading(false);
      return;
    }
    let alive = true;
    setContactLoading(true);
    fetchContactPhone(id)
      .then((phone) => {
        if (!alive) return;
        setContactPhone(phone);
        setContactLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setContactPhone(null);
        setContactLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, contactUnlocked, bookingProId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pendingOffers = useMemo(
    () => offers.filter((o) => o.status === "pending").sort((a, b) => quoteSortKey(a) - quoteSortKey(b)),
    [offers]
  );
  const declinedOffers = useMemo(() => offers.filter((o) => o.status === "rejected"), [offers]);

  const acceptOffer = useCallback(
    (offer: QuoteOffer) => {
      const name = proDisplayName(offer.professional) || t("quoteUnknownPro");
      const price = quotePriceText(offer.price_min, offer.price_max, offer.price);
      Alert.alert(
        t("quoteAcceptTitle"),
        price ? t("quoteAcceptConfirm", { name, price }) : t("quoteAcceptConfirmNoPrice", { name }),
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("confirm"),
            onPress: async () => {
              setBusyOfferId(offer.id);
              const { error } = await supabase.rpc("accept_offer", { p_offer_id: offer.id });
              setBusyOfferId(null);
              if (error) {
                toast.error(t("error"));
                await load();
                return;
              }
              toast.success(t("quoteAcceptedToast", { name }));
              await load();
            },
          },
        ]
      );
    },
    [load, t, toast]
  );

  /**
   * How many quotes arrived since this screen was last opened.
   *
   * A banner that reads "a new offer arrived!" every time you open the screen
   * for a week isn't news, it's wallpaper — so it's anchored to a per-request
   * timestamp. The count is taken once per mount and then frozen: pull-to-
   * refresh shouldn't make the banner vanish out from under the person reading
   * it. On a first-ever visit every quote is genuinely new, which is right.
   */
  // open the request body once the comparing is over
  const detailsDefaultedRef = useRef(false);
  useEffect(() => {
    if (detailsDefaultedRef.current || !booking) return;
    detailsDefaultedRef.current = true;
    if (booking.status !== "open") setDetailsOpen(true);
  }, [booking]);

  const [unseenOffers, setUnseenOffers] = useState(0);
  const seenMarkedRef = useRef(false);
  useEffect(() => {
    if (seenMarkedRef.current || !id || pendingOffers.length === 0) return;
    seenMarkedRef.current = true;
    (async () => {
      const key = `dalconnect.seenOffers.${id}`;
      let since = 0;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) since = new Date(raw).getTime();
      } catch {
        // storage unavailable — treat everything as new rather than nothing
      }
      const times = pendingOffers.map((o) => new Date(o.created_at).getTime());
      setUnseenOffers(times.filter((ts) => ts > since).length);
      const newest = Math.max(...times);
      if (Number.isFinite(newest)) {
        AsyncStorage.setItem(key, new Date(newest).toISOString()).catch(() => {});
      }
    })();
  }, [id, pendingOffers]);

  const declineOffer = useCallback(
    async (offer: QuoteOffer) => {
      if (busyOfferId) return;
      const name = proDisplayName(offer.professional) || t("quoteUnknownPro");
      setBusyOfferId(offer.id);
      const { error } = await supabase.rpc("decline_offer", { p_offer_id: offer.id });
      setBusyOfferId(null);
      if (error) {
        toast.error(t("error"));
        await load();
        return;
      }
      toast.info(t("quoteDeclinedToast", { name }));
      await load();
    },
    [busyOfferId, load, t, toast]
  );

  const doCancel = async () => {
    if (!booking || cancelling) return;
    setCancelling(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancel_reason: cancelReason.trim() || null })
      .eq("id", booking.id);
    setCancelling(false);
    setCancelVisible(false);
    if (error) {
      toast.error(t("error"));
      return;
    }
    setCancelReason("");
    toast.info(t("bookingCancelledToast"));
    load();
  };

  /**
   * The customer's side of "the job is done" — the professional's own
   * completion flow (job/[id].tsx) still exists and still records the actual
   * final_price; this is what happens when the CUSTOMER is the one who
   * notices work has wrapped up. Deliberately sends only `status` — the DB
   * guard (20260714000009) rejects final_price/commission from this side no
   * matter what, so there's nothing to gain by asking for them here.
   */
  const doConfirmDone = async () => {
    if (!booking || confirmingDone) return;
    setConfirmingDone(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", booking.id)
      .eq("status", booking.status); // someone else may have moved it meanwhile
    setConfirmingDone(false);
    setConfirmDoneVisible(false);
    if (error) {
      toast.error(t("error"));
      return;
    }
    setJustConfirmedDone(true);
    toast.success(t("workDoneToast"));
    load();
  };

  const openChatWith = useCallback(
    async (professionalId: string | null | undefined) => {
      if (!professionalId || !booking || chatLoading) return;
      setChatLoading(true);
      try {
        const convId = await getOrCreateConversation(booking.customer_id, professionalId);
        router.push(`/chat/${convId}` as never);
      } catch {
        toast.error(t("error"));
      } finally {
        setChatLoading(false);
      }
    },
    [booking, chatLoading, router, t, toast]
  );

  const openChat = () => openChatWith(booking?.professional_id);

  if (loading) return <Loading />;

  const header = (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.bg,
        ...ROW,
        gap: 12,
      }}
    >
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="arrow-forward" size={24} color={colors.text} />
      </Pressable>
      <Text style={[RTL_TEXT, { color: colors.text, fontSize: 18, fontWeight: "800" }]}>{t("bookingDetails")}</Text>
    </View>
  );

  if (!booking) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <EmptyState icon="clipboard-alert-outline" title={t("bookingNotFound")} />
      </View>
    );
  }

  const isTerminated = booking.status === "cancelled" || booking.status === "rejected";
  const currentIdx = trackIndex(booking.status, pendingOffers.length);
  const pro = booking.professional ?? null;
  const proName = proDisplayName(pro);
  const canCancel = booking.status === "open" || booking.status === "pending" || booking.status === "accepted";
  const cancelLocked = CANCEL_LOCKED.includes(booking.status);
  const isDone = booking.status === "completed" || booking.status === "rated";
  // Contact card takes over once a quote is accepted; the plain pro card still
  // covers direct bookings awaiting the pro's answer (and terminated ones).
  const showContactCard = contactUnlocked && pro !== null;
  const showPlainProCard = pro !== null && !contactUnlocked && booking.status !== "open";

  const serviceFee = toNumber(booking.service_fee) ?? 0;
  const finalPrice = toNumber(booking.final_price);
  const agreedRange = quotePriceText(booking.price_min, booking.price_max, booking.price);
  // Completed jobs show what was actually charged; everything else shows the
  // range that was agreed when the quote was accepted.
  const showFinal = isDone && finalPrice !== null;
  const priceText = showFinal ? formatPrice(finalPrice) : agreedRange;
  const priceLabel = showFinal ? t("quoteFinalPriceLabel") : t("quoteAgreedPriceLabel");
  const categoryName = booking.category ? loc(booking.category, "name") : "";
  const jobTitle = booking.title || categoryName || t("category");
  const whatsappMessage = t("quoteWhatsAppPrefill", { title: booking.title || categoryName });
  const isUrgent = booking.urgency === "same_day";
  // Badge tones and StatusPill tones agree everywhere except "gold", which the
  // pill doesn't have — the warn tint is the same amber.
  const statusTone = STATUS_TONE[booking.status];
  const pillTone = statusTone === "gold" ? "warn" : statusTone;
  // The customer's own words + photos sit above a hairline; the logistics
  // (where, when, how much) sit below it. No words, no rule.
  const hasJobBody = Boolean(booking.description || booking.photos.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* ---------- what the job is + where it stands (one card) ---------- */}
        <Card style={{ gap: spacing.md }}>
          {/* compact identity line: what the job is, then trade · urgency on one
              muted row. It used to be a two-line title with a badge block under
              it, which ate the top of the screen before saying anything. */}
          <View style={{ ...ROW, gap: 10, alignItems: "center" }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: radius.md,
                backgroundColor: colors.brandTint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name={(booking.category?.icon as MCIName) ?? "tools"}
                size={20}
                color={colors.brand}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}
              >
                {jobTitle}
              </Text>
              <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>
                {[categoryName, isUrgent ? t("quoteUrgencyUrgent") : t("quoteUrgencyScheduled")]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.hairline }} />

          {isTerminated ? (
            <View
              style={{
                backgroundColor: colors.dangerTint,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 5,
              }}
            >
              <View style={{ ...ROW, gap: 8 }}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 14, fontWeight: "800", flex: 1 }]}>
                  {booking.status === "cancelled" ? t("cancelledBanner") : t("rejectedBanner")}
                </Text>
              </View>
              {booking.cancel_reason ? (
                <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12.5, lineHeight: 18 }]}>
                  {t("cancelReasonLabel")}: {booking.cancel_reason}
                </Text>
              ) : null}
            </View>
          ) : (
            /* Named tracker. "1/5" told the customer they were somewhere in a
               five-step process without saying what the five steps were, or
               what step 2 would be. Milestones answer both at a glance. */
            <View style={{ gap: 10 }}>
              <View style={{ ...ROW }}>
                <StatusPill
                  label={t(STATUS_KEY[booking.status])}
                  tone={pillTone}
                  glow={booking.status === "open" || booking.status === "in_progress"}
                />
              </View>

              {/* row-reverse: the journey runs right to left */}
              <View style={{ ...ROW, alignItems: "flex-start" }}>
                {TRACK_STEPS.map((key, i) => {
                  const done = i < currentIdx;
                  const current = i === currentIdx;
                  const last = i === TRACK_STEPS.length - 1;
                  // Inside each step the row is NOT reversed, so "start" is the
                  // visual left — which points at the NEXT milestone.
                  const line = (visible: boolean, filled: boolean) => (
                    <View
                      style={{
                        flex: 1,
                        height: 2,
                        backgroundColor: visible ? (filled ? colors.brand : colors.chip) : "transparent",
                      }}
                    />
                  );
                  return (
                    <View key={key} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                      {/* height fixed to the LARGEST dot (22, the current step's).
                          Each milestone's row was sized to its own dot instead —
                          14px for five of them, 22px for the current one — and
                          with the outer track aligned to flex-start (tops, not
                          centers), that made the current step's row taller, so
                          its centered line sat ~4px lower than its neighbours':
                          a visible step in the line exactly at the current dot. */}
                      <View style={{ flexDirection: "row", alignItems: "center", width: "100%", height: 22 }}>
                        {line(!last, done)}
                        {/* the current step is the answer to "where am I?", so it
                            is the only filled, ringed, brand-coloured dot */}
                        <View
                          style={{
                            width: current ? 22 : 14,
                            height: current ? 22 : 14,
                            borderRadius: radius.full,
                            backgroundColor: done || current ? colors.brand : colors.chip,
                            borderWidth: current ? 4 : 0,
                            borderColor: colors.brandTint,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {done ? <Ionicons name="checkmark" size={9} color={colors.onBrand} /> : null}
                        </View>
                        {line(i > 0, i <= currentIdx)}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: current ? colors.brand : done ? colors.text : colors.faint,
                          fontSize: current ? 11.5 : 10.5,
                          fontWeight: current ? "800" : "600",
                          textAlign: "center",
                        }}
                      >
                        {t(key)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        {/* ---------- contact: the payoff of accepting a quote, so it leads ---------- */}
        {showContactCard ? (
          <View>
            <SectionHeader title={t("quoteContactTitle")} />
            <Card style={{ gap: spacing.lg }}>
              <Pressable
                onPress={() => (booking.professional_id ? router.push(`/pro/${booking.professional_id}` as never) : null)}
                style={({ pressed }) => ({ ...ROW, gap: 12, opacity: pressed ? 0.7 : 1 })}
              >
                <Avatar uri={pro?.profile?.avatar_url} name={proName} size={54} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ ...ROW, gap: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={[RTL_TEXT, { color: colors.text, fontSize: 16.5, fontWeight: "800", flexShrink: 1 }]}
                    >
                      {proName || t("quoteUnknownPro")}
                    </Text>
                    {pro?.verification_status === "approved" ? (
                      <MaterialCommunityIcons name="check-decagram" size={16} color={colors.info} />
                    ) : null}
                  </View>
                  <View style={{ ...ROW, gap: 6 }}>
                    <StarRating rating={pro?.rating_avg ?? 0} size={13} />
                    {(pro?.rating_count ?? 0) > 0 ? (
                      <Text style={[MONEY_TEXT, { color: colors.muted, fontSize: 12 }]}>
                        {`${Number(pro?.rating_avg ?? 0).toFixed(1)} (${pro?.rating_count ?? 0})`}
                      </Text>
                    ) : (
                      <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>{t("quoteNoRatingYet")}</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-back" size={18} color={colors.faint} />
              </Pressable>

              {priceText ? (
                <View
                  style={{
                    backgroundColor: colors.brandTint,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    ...ROW,
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <Text style={[RTL_TEXT, { color: colors.brandDark, fontSize: 12.5, fontWeight: "700" }]}>
                    {priceLabel}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[MONEY_TEXT, { color: colors.brand, fontSize: 20, fontWeight: "800", flexShrink: 1 }]}
                  >
                    {priceText}
                  </Text>
                </View>
              ) : null}

              {contactLoading ? (
                <View style={{ paddingVertical: spacing.md, alignItems: "center" }}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              ) : contactPhone ? (
                <View style={{ gap: spacing.md }}>
                  <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, lineHeight: 18 }]}>
                    {t("quoteContactHint")}
                  </Text>
                  {/* the number itself: Latin digits, pinned LTR so it never flips */}
                  <Text
                    style={[
                      MONEY_TEXT,
                      { textAlign: "center", color: colors.text, fontSize: 19, fontWeight: "800", letterSpacing: 1 },
                    ]}
                  >
                    {contactPhone}
                  </Text>
                  <Button
                    title={t("quoteCallNow")}
                    icon="phone"
                    onPress={() => {
                      callPhone(contactPhone);
                    }}
                  />
                  <Button
                    title={t("quoteWhatsApp")}
                    icon="whatsapp"
                    variant="success"
                    onPress={() => {
                      openWhatsApp(contactPhone, whatsappMessage);
                    }}
                  />
                  <QuietAction
                    icon="chatbubble-ellipses-outline"
                    label={t("quoteChatInApp")}
                    color={colors.brand}
                    onPress={openChat}
                    disabled={chatLoading}
                  />
                </View>
              ) : (
                <View style={{ gap: spacing.md }}>
                  <InlineNote tone="warn" icon="lock-outline" text={t("quoteContactPending")} />
                  <Button
                    title={t("quoteChatInApp")}
                    icon="chat-outline"
                    variant="outline"
                    loading={chatLoading}
                    onPress={openChat}
                  />
                </View>
              )}
            </Card>
          </View>
        ) : null}

        {/* ---------- quotes — the hero while the request is collecting ---------- */}
        {booking.status === "open" ? (
          <View>
            {/* the main event on this screen, so it gets to announce itself —
                quietly: a tinted strip, not a slab of brand colour */}
            {unseenOffers > 0 ? (
              <View
                style={{
                  ...ROW,
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: colors.successTint,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                }}
              >
                <MaterialCommunityIcons name="party-popper" size={22} color={colors.success} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[RTL_TEXT, { color: colors.success, fontSize: 14, fontWeight: "800" }]}>
                    {t("newOffersTitle")}
                  </Text>
                  <Text style={[RTL_TEXT, { color: colors.success, fontSize: 12, lineHeight: 17 }]}>
                    {pendingOffers.length === 1
                      ? t("newOffersBodyOne")
                      : t("newOffersBody", { n: pendingOffers.length })}
                  </Text>
                </View>
              </View>
            ) : null}

            <SectionHeader title={t("quotesTitle", { n: pendingOffers.length })} />
            {pendingOffers.length === 0 ? (
              <View style={{ gap: spacing.md }}>
                <Pulse>
                  <Card style={{ alignItems: "center", gap: 8, paddingVertical: spacing.xl }}>
                    <MaterialCommunityIcons name="timer-sand" size={30} color={colors.brand} />
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
                      {t("waitingOffersTitle")}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", lineHeight: 19 }}>
                      {t("waitingOffersSubtitle")}
                    </Text>
                  </Card>
                </Pulse>
                <View style={{ ...ROW, gap: 6, justifyContent: "center", paddingHorizontal: spacing.md }}>
                  <Ionicons name="notifications-outline" size={14} color={colors.faint} />
                  <Text style={{ color: colors.faint, fontSize: 12, flexShrink: 1, textAlign: "center" }}>
                    {t("notifyProsHint")}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                {/* one line — by this point the customer knows the job */}
                <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, lineHeight: 18 }]}>
                  {t("quotesCompareShort")}
                </Text>
                {pendingOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    busy={busyOfferId === offer.id}
                    disabled={busyOfferId !== null && busyOfferId !== offer.id}
                    onAccept={acceptOffer}
                    onDecline={declineOffer}
                    onChat={(o) => openChatWith(o.professional_id)}
                  />
                ))}
              </View>
            )}

            {/* declined quotes stay visible (collapsed) — a quote that simply
                disappeared would read as a bug */}
            {declinedOffers.length > 0 ? (
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <Pressable
                  onPress={() => setShowDeclined((v) => !v)}
                  style={({ pressed }) => ({ ...ROW, gap: 6, opacity: pressed ? 0.6 : 1, paddingVertical: 4 })}
                >
                  <Ionicons name={showDeclined ? "chevron-up" : "chevron-down"} size={15} color={colors.muted} />
                  <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, fontWeight: "700" }]}>
                    {t("quotesDeclinedTitle", { n: declinedOffers.length })}
                  </Text>
                </Pressable>
                {showDeclined ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, lineHeight: 18 }]}>
                      {t("quotesDeclinedHint")}
                    </Text>
                    {declinedOffers.map((offer) => {
                      const name = proDisplayName(offer.professional);
                      const price = quotePriceText(offer.price_min, offer.price_max, offer.price);
                      return (
                        <View
                          key={offer.id}
                          style={{
                            ...ROW,
                            gap: 10,
                            backgroundColor: colors.chip,
                            borderRadius: radius.md,
                            padding: spacing.md,
                            opacity: 0.75,
                          }}
                        >
                          <Avatar uri={offer.professional?.profile?.avatar_url} name={name} size={32} />
                          <Text
                            numberOfLines={1}
                            style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 13.5, fontWeight: "700" }]}
                          >
                            {name || t("quoteUnknownPro")}
                          </Text>
                          {price ? (
                            <Text
                              style={[
                                MONEY_TEXT,
                                { color: colors.faint, fontSize: 13, textDecorationLine: "line-through" },
                              ]}
                            >
                              {price}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Editing belongs here, right after the quotes: seeing what people
                offered is exactly when you realise the description was thin.
                A light card, not a button competing with "accept". */}
            <Pressable
              onPress={() => router.push(`/create-booking?editId=${booking.id}` as never)}
              style={({ pressed }) => [
                {
                  ...ROW,
                  alignItems: "center",
                  gap: spacing.md,
                  marginTop: spacing.lg,
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                },
                pressed ? { opacity: 0.75 } : null,
              ]}
            >
              <Ionicons name="create-outline" size={19} color={colors.brand} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[RTL_TEXT, { color: colors.text, fontSize: 13.5, fontWeight: "700" }]}>
                  {t("editPromptTitle")}
                </Text>
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 11.5, lineHeight: 16 }]}>
                  {t("editPromptBody")}
                </Text>
              </View>
              <Ionicons name="chevron-back" size={15} color={colors.faint} />
            </Pressable>
          </View>
        ) : null}

        {/* assigned professional, before contact unlocks (direct bookings) */}
        {showPlainProCard ? (
          <View>
            <SectionHeader title={t("proSectionTitle")} />
            <Card style={{ gap: spacing.md }}>
              <Pressable
                onPress={() => (booking.professional_id ? router.push(`/pro/${booking.professional_id}` as never) : null)}
                style={({ pressed }) => ({ ...ROW, gap: 12, opacity: pressed ? 0.7 : 1 })}
              >
                <Avatar uri={pro?.profile?.avatar_url} name={proName} size={48} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ ...ROW, gap: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800", flexShrink: 1 }]}
                    >
                      {proName || t("quoteUnknownPro")}
                    </Text>
                    {pro?.verification_status === "approved" ? (
                      <MaterialCommunityIcons name="check-decagram" size={15} color={colors.info} />
                    ) : null}
                  </View>
                  <View style={{ ...ROW, gap: 6 }}>
                    <StarRating rating={pro?.rating_avg ?? 0} size={13} />
                    <Text style={[MONEY_TEXT, { color: colors.muted, fontSize: 12 }]}>
                      {`${Number(pro?.rating_avg ?? 0).toFixed(1)} (${pro?.rating_count ?? 0})`}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-back" size={18} color={colors.faint} />
              </Pressable>
              <Button title={t("message")} icon="chat" small loading={chatLoading} onPress={openChat} />
            </Card>
          </View>
        ) : null}

        {/* ---------- customer confirms the work is done ----------
             The professional has their own way to close a job out (with the
             price they actually charged); this is what happens when the
             CUSTOMER is the one who notices the work has wrapped up, so a job
             doesn't sit stuck in "on the way" because the pro forgot to tap
             their own button. Only appears once someone is actually en route
             or on site — before that there's nothing to confirm.
             Sits above the request details on purpose: once a job is under
             way, "is it done?" is the more urgent question than "what did I
             ask for?" — the reference material can wait one card further. */}
        {booking.status === "on_the_way" || booking.status === "in_progress" ? (
          <Card style={{ gap: spacing.md }}>
            <View style={{ ...ROW, gap: 10, alignItems: "center" }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.md,
                  backgroundColor: colors.successTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="flag-checkered" size={19} color={colors.success} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[RTL_TEXT, { color: colors.text, fontSize: 14.5, fontWeight: "800" }]}>
                  {t("finishWorkTitle")}
                </Text>
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12, lineHeight: 17 }]}>
                  {t("finishWorkSubtitle")}
                </Text>
              </View>
            </View>
            <Button
              title={t("confirmWorkDone")}
              icon="check-circle-outline"
              onPress={() => setConfirmDoneVisible(true)}
            />
          </Card>
        ) : null}

        {/* ---------- what the customer already typed: it recedes ----------
             While quotes are the job of this screen, the request itself is
             reference material — two lines and a tap. Once a professional is
             chosen there's nothing to compare any more, so it opens by default. */}
        <View>
          <SectionHeader title={t("requestDetailsTitle")} />
          <Card style={{ gap: spacing.md }}>
            {booking.description ? (
              <Text
                numberOfLines={detailsOpen ? undefined : 2}
                style={[RTL_TEXT, { color: colors.text, fontSize: 13.5, lineHeight: 21 }]}
              >
                {booking.description}
              </Text>
            ) : null}

            {/* the one-line summary that stands in for the collapsed body */}
            {!detailsOpen ? (
              <View style={{ ...ROW, alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {booking.city || booking.address ? (
                  <View style={{ ...ROW, alignItems: "center", gap: 5 }}>
                    <Ionicons name="location-outline" size={13} color={colors.faint} />
                    <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>
                      {[booking.city ? loc(booking.city, "name") : null, booking.address || null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                ) : null}
                <View style={{ ...ROW, alignItems: "center", gap: 5 }}>
                  <Ionicons name="time-outline" size={13} color={colors.faint} />
                  <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>
                    {booking.scheduled_at ? formatDateTime(booking.scheduled_at, lang) : t("asap")}
                  </Text>
                </View>
                {booking.photos.length > 0 ? (
                  <View style={{ ...ROW, alignItems: "center", gap: 5 }}>
                    <Ionicons name="image-outline" size={13} color={colors.faint} />
                    <Text style={[MONEY_TEXT, { color: colors.muted, fontSize: 12 }]}>
                      {booking.photos.length}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              onPress={() => setDetailsOpen((v) => !v)}
              hitSlop={6}
              style={({ pressed }) => ({ ...ROW, gap: 5, alignItems: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: colors.brand, fontSize: 12.5, fontWeight: "700" }}>
                {detailsOpen ? t("hideFullDetails") : t("showFullDetails")}
              </Text>
              <Ionicons name={detailsOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.brand} />
            </Pressable>

            {detailsOpen && booking.photos.length > 0 ? (
              <ScrollView
                ref={photosRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={() => photosRef.current?.scrollToEnd({ animated: false })}
                contentContainerStyle={{ gap: 8, flexDirection: "row-reverse" }}
              >
                {booking.photos.map((uri) => (
                  <Pressable key={uri} onPress={() => setViewerUri(uri)}>
                    <Image
                      source={{ uri }}
                      style={{ width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.chip }}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {detailsOpen && hasJobBody ? (
              <View style={{ height: 1, backgroundColor: colors.hairline }} />
            ) : null}

            {detailsOpen &&
            (booking.address || booking.city || (booking.lat != null && booking.lng != null)) ? (
              <View style={{ ...ROW, gap: 8, alignItems: "flex-start" }}>
                <Ionicons name="location-outline" size={16} color={colors.faint} style={{ marginTop: 2 }} />
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, flex: 1, lineHeight: 19 }]}>
                  {[booking.city ? loc(booking.city, "name") : null, booking.address || null]
                    .filter(Boolean)
                    .join(" · ") || t("locationOnMap")}
                </Text>
                {booking.lat != null && booking.lng != null ? (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(
                        `https://www.google.com/maps/search/?api=1&query=${booking.lat},${booking.lng}`
                      ).catch(() => {})
                    }
                    hitSlop={8}
                    style={({ pressed }) => ({ ...ROW, gap: 4, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Ionicons name="map-outline" size={14} color={colors.brand} />
                    <Text style={{ color: colors.brand, fontSize: 12.5, fontWeight: "700" }}>{t("openInMaps")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {detailsOpen ? (
              <View style={{ ...ROW, gap: 8 }}>
                <Ionicons name="time-outline" size={16} color={colors.faint} />
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, flex: 1 }]}>
                  {`${t("scheduledFor")}: ${
                    booking.scheduled_at ? formatDateTime(booking.scheduled_at, lang) : t("asap")
                  }`}
                </Text>
              </View>
            ) : null}

            {/* money summary: agreed range / final price, plus the request fee.
                A zero fee renders nothing — "₪0" would only confuse. */}
            {priceText || serviceFee > 0 ? (
              <>
                <View style={{ height: 1, backgroundColor: colors.hairline }} />
                <View style={{ gap: 8 }}>
                  {priceText ? (
                    <>
                      <View style={{ ...ROW, justifyContent: "space-between", gap: 10 }}>
                        <Text style={[RTL_TEXT, { color: colors.text, fontSize: 14, fontWeight: "700" }]}>
                          {priceLabel}
                        </Text>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                          style={[MONEY_TEXT, { color: colors.brand, fontSize: 19, fontWeight: "800", flexShrink: 1 }]}
                        >
                          {priceText}
                        </Text>
                      </View>
                      <View style={{ ...ROW, gap: 8 }}>
                        <Badge label={t("cash")} tone="success" />
                        <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, flex: 1, lineHeight: 18 }]}>
                          {showFinal ? t("cashNote") : t("quoteRangeNote")}
                        </Text>
                      </View>
                    </>
                  ) : null}
                  {serviceFee > 0 ? (
                    <View style={{ ...ROW, gap: 6 }}>
                      <Ionicons name="receipt-outline" size={14} color={colors.faint} />
                      <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, flexShrink: 1 }]}>
                        {t("quoteServiceFee", { amount: formatPrice(serviceFee) })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </Card>
        </View>

        {/* given rating (readonly) — shown as soon as the review row exists,
            even if the trigger hasn't flipped the status to 'rated' yet */}
        {review ? (
          <Card style={{ ...ROW, justifyContent: "space-between", gap: 10 }}>
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 14.5, fontWeight: "700" }]}>
              {t("yourRating")}
            </Text>
            <StarRating rating={review.rating} size={20} />
          </Card>
        ) : null}

        {/* ---------- actions: one loud, the rest quiet ---------- */}
        <View style={{ gap: spacing.xs }}>
          {booking.status === "completed" && booking.professional_id && !review ? (
            justConfirmedDone ? (
              // the moment right after confirming — a fuller thank-you rather
              // than the same plain button someone sees returning days later
              <View
                style={{
                  backgroundColor: colors.successTint,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Ionicons name="checkmark-circle" size={30} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 15.5, fontWeight: "800", textAlign: "center" }}>
                  {t("workDoneBannerTitle")}
                </Text>
                <Text style={{ color: colors.success, fontSize: 12.5, lineHeight: 18, textAlign: "center" }}>
                  {t("workDoneBannerBody")}
                </Text>
                <Pressable
                  onPress={() => setRateVisible(true)}
                  hitSlop={8}
                  style={({ pressed }) => ({ ...ROW, gap: 5, alignItems: "center", opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ color: colors.success, fontSize: 13.5, fontWeight: "800", textDecorationLine: "underline" }}>
                    {t("goToRating")}
                  </Text>
                  <Ionicons name="chevron-back" size={14} color={colors.success} />
                </Pressable>
              </View>
            ) : (
              <Button title={t("rateService")} icon="star" onPress={() => setRateVisible(true)} />
            )
          ) : null}

          {/* Once the pro is on the job the cancel button is gone; without this the
              customer is left wondering how to call it off. */}
          {cancelLocked ? (
            <Pressable
              onPress={openChat}
              disabled={!booking.professional_id || chatLoading}
              style={({ pressed }) => ({
                ...ROW,
                gap: 8,
                backgroundColor: colors.warnTint,
                borderRadius: radius.md,
                paddingHorizontal: 12,
                paddingVertical: 12,
                marginBottom: spacing.xs,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="lock-closed-outline" size={17} color={colors.warn} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[RTL_TEXT, { color: colors.warn, fontSize: 12.5, lineHeight: 18 }]}>
                  {isDone ? t("cancelLockedDone") : t("cancelLockedWorking")}
                </Text>
                {booking.professional_id ? (
                  <Text style={[RTL_TEXT, { color: colors.warn, fontSize: 12.5, fontWeight: "800" }]}>
                    {t("contactProCta")}
                  </Text>
                ) : null}
              </View>
              {booking.professional_id ? <Ionicons name="chevron-back" size={16} color={colors.warn} /> : null}
            </Pressable>
          ) : null}

          {/* editing lives up with the quotes now — one entry point, at the
              moment the customer actually realises they want it */}
          {canCancel ? (
            <QuietAction
              icon="close-circle-outline"
              label={t("cancelBooking")}
              color={colors.danger}
              onPress={() => setCancelVisible(true)}
            />
          ) : null}

          {/* Reporting sits below the rule and at tertiary weight. It was reading
              as the peer of cancelling, and while a request is still collecting
              quotes there is no professional to report anything about. */}
          <View style={{ height: 1, backgroundColor: colors.hairline, marginTop: 4 }} />
          <QuietAction
            small
            icon="alert-circle-outline"
            label={t("reportProblem")}
            color={colors.faint}
            onPress={() =>
              router.push(
                (`/report?bookingId=${booking.id}` +
                  (booking.professional_id ? `&userId=${booking.professional_id}` : "")) as never
              )
            }
          />
        </View>
      </ScrollView>

      {/* rate modal */}
      {booking.professional_id ? (
        <RateModal
          visible={rateVisible}
          bookingId={booking.id}
          customerId={booking.customer_id}
          professionalId={booking.professional_id}
          onClose={() => setRateVisible(false)}
          onDone={() => {
            setRateVisible(false);
            load();
          }}
        />
      ) : null}

      {/* cancel confirm modal — the reason field opens a keyboard, so this has
          to move out of its way like any other form */}
      <Modal visible={cancelVisible} transparent animationType="fade" onRequestClose={() => setCancelVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
          }}
        >
          <Card style={{ width: "100%", maxWidth: 380, gap: spacing.lg }}>
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>
              {t("cancelBooking")}
            </Text>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 20 }]}>
              {t("cancelConfirm")}
            </Text>
            <Input
              placeholder={t("cancelReasonPlaceholder")}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              style={{ minHeight: 64, textAlignVertical: "top" }}
            />
            <View style={{ ...ROW, gap: 10 }}>
              <Button
                title={t("keepBooking")}
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => setCancelVisible(false)}
              />
              <Button
                title={t("confirm")}
                variant="danger"
                style={{ flex: 1 }}
                loading={cancelling}
                onPress={doCancel}
              />
            </View>
          </Card>
        </KeyboardAvoidingView>
      </Modal>

      {/* confirm-completion modal — same shape as the cancel one: state the
          consequence, then a calm way back out */}
      <Modal
        visible={confirmDoneVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDoneVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
          }}
        >
          <Card style={{ width: "100%", maxWidth: 380, gap: spacing.lg }}>
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>
              {t("confirmWorkDoneTitle")}
            </Text>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 20 }]}>
              {t("confirmWorkDoneBody")}
            </Text>
            <View style={{ ...ROW, gap: 10 }}>
              <Button
                title={t("keepBooking")}
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => setConfirmDoneVisible(false)}
              />
              <Button
                title={t("confirmWorkDone")}
                style={{ flex: 1 }}
                loading={confirmingDone}
                onPress={doConfirmDone}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* fullscreen photo viewer — the backdrop is the one place a raw hex is
          right: it must be black regardless of the theme */}
      <Modal visible={viewerUri !== null} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
          <Pressable
            onPress={() => setViewerUri(null)}
            hitSlop={12}
            style={{ position: "absolute", top: insets.top + 12, left: 20, zIndex: 2 }}
          >
            <Ionicons name="close" size={30} color="#ffffff" />
          </Pressable>
          {viewerUri ? (
            <Image source={{ uri: viewerUri }} style={{ flex: 1 }} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
