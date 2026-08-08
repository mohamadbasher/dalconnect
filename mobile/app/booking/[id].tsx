// Booking detail — customer view of a REQUEST.
//
// The flow this screen serves: the customer posts a request, every nearby
// professional in the trade answers with a quote (a price RANGE + arrival time
// + a note), the customer compares them, accepts one — and only then does the
// professional's phone number appear so the two can settle the details by
// phone or WhatsApp.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
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
import { formatDateTime, STATUS_KEY } from "../../lib/format";
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
} from "../../components/ui";
import { OfferCard, proDisplayName, quotePriceText } from "../../components/OfferCard";
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

function stepIndex(status: BookingStatus): number {
  switch (status) {
    case "open":
    case "pending":
      return 0;
    case "accepted":
      return 1;
    case "on_the_way":
      return 2;
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

export default function BookingDetail() {
  const { colors, shadows } = useTheme();
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
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [rateVisible, setRateVisible] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("bookings")
      .select(
        "*, category:categories(*), city:cities(*), professional:professionals(*, profile:profiles!professionals_id_fkey(*))"
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
          "*, professional:professionals(*, profile:profiles!professionals_id_fkey(*), city:cities(*))"
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

  const openChat = async () => {
    if (!booking?.professional_id || !session?.user.id || chatLoading) return;
    setChatLoading(true);
    try {
      const convId = await getOrCreateConversation(booking.customer_id, booking.professional_id);
      router.push(`/chat/${convId}` as never);
    } catch {
      toast.error(t("error"));
    } finally {
      setChatLoading(false);
    }
  };

  const steps = useMemo(() => {
    if (!booking) return [];
    const first: BookingStatus = booking.type === "direct" ? "pending" : "open";
    const list: BookingStatus[] = [first, "accepted", "on_the_way", "in_progress", "completed"];
    return list;
  }, [booking]);

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
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{t("bookingDetails")}</Text>
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
  const currentIdx = stepIndex(booking.status);
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
  const whatsappMessage = t("quoteWhatsAppPrefill", {
    title: booking.title || (booking.category ? loc(booking.category, "name") : ""),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32, gap: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* status: danger banner or timeline */}
        {isTerminated ? (
          <View
            style={{
              backgroundColor: colors.dangerTint,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: 6,
            }}
          >
            <View style={{ ...ROW, gap: 8 }}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 15, fontWeight: "800", flex: 1 }]}>
                {booking.status === "cancelled" ? t("cancelledBanner") : t("rejectedBanner")}
              </Text>
            </View>
            {booking.cancel_reason ? (
              <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 13 }]}>
                {t("cancelReasonLabel")}: {booking.cancel_reason}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("bookingStatus")} />
            <Card style={{ gap: spacing.md }}>
              {/* horizontal tracker: dots on a connector rail */}
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}>
                {steps.map((s, i) => {
                  const done = i <= currentIdx;
                  const current = i === currentIdx;
                  return (
                    <View key={s} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                      {i > 0 ? (
                        // the rail runs from this dot back to the previous one (RTL: to its right)
                        <View
                          style={{
                            position: "absolute",
                            height: 3,
                            top: 9.5,
                            right: "-50%",
                            width: "100%",
                            backgroundColor: done ? colors.brand : colors.border,
                          }}
                        />
                      ) : null}
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: radius.full,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 2,
                          backgroundColor: done ? colors.brand : colors.chip,
                          borderColor: done ? colors.brand : colors.border,
                          ...(current ? shadows.cta : null),
                        }}
                      >
                        {done ? <Ionicons name="checkmark" size={12} color={colors.onBrand} /> : null}
                      </View>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: 11,
                          textAlign: "center",
                          color: done ? colors.text : colors.muted,
                          fontWeight: done ? "700" : "500",
                        }}
                      >
                        {t(STATUS_KEY[s === "completed" && booking.status === "rated" ? "rated" : s])}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* ---------- contact card: the payoff of accepting a quote ---------- */}
        {showContactCard ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("quoteContactTitle")} />
            <Card style={{ gap: spacing.lg }}>
              <Pressable
                onPress={() => (booking.professional_id ? router.push(`/pro/${booking.professional_id}` as never) : null)}
                style={({ pressed }) => ({ ...ROW, gap: 12, opacity: pressed ? 0.7 : 1 })}
              >
                <Avatar uri={pro?.profile?.avatar_url} name={proName} size={52} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ ...ROW, gap: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800", flexShrink: 1 }]}
                    >
                      {proName || t("quoteUnknownPro")}
                    </Text>
                    {pro?.verification_status === "approved" ? (
                      <MaterialCommunityIcons name="check-decagram" size={16} color={colors.info} />
                    ) : null}
                  </View>
                  <View style={{ ...ROW, gap: 6 }}>
                    <StarRating rating={pro?.rating_avg ?? 0} size={13} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {(pro?.rating_count ?? 0) > 0
                        ? `${Number(pro?.rating_avg ?? 0).toFixed(1)} (${pro?.rating_count ?? 0})`
                        : t("quoteNoRatingYet")}
                    </Text>
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
                    style={{ color: colors.brand, fontSize: 20, fontWeight: "800", flexShrink: 1 }}
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
                  <View style={{ ...ROW, gap: 10 }}>
                    <Button
                      title={t("call")}
                      icon="phone"
                      style={{ flex: 1 }}
                      onPress={() => {
                        callPhone(contactPhone);
                      }}
                    />
                    <Button
                      title={t("quoteWhatsApp")}
                      icon="whatsapp"
                      variant="success"
                      style={{ flex: 1 }}
                      onPress={() => {
                        openWhatsApp(contactPhone, whatsappMessage);
                      }}
                    />
                  </View>
                  <Button
                    title={t("quoteChatInApp")}
                    icon="chat-outline"
                    variant="outline"
                    loading={chatLoading}
                    onPress={openChat}
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

        {/* ---------- quotes — only while the request is collecting ---------- */}
        {booking.status === "open" ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("quotesTitle", { n: pendingOffers.length })} />
            {pendingOffers.length === 0 ? (
              <View style={{ gap: spacing.md }}>
                <Pulse>
                  <Card style={{ alignItems: "center", gap: 8, paddingVertical: spacing.xl }}>
                    <MaterialCommunityIcons name="timer-sand" size={30} color={colors.brand} />
                    <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "700", textAlign: "center" }]}>
                      {t("waitingOffersTitle")}
                    </Text>
                    <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, textAlign: "center" }]}>
                      {t("waitingOffersSubtitle")}
                    </Text>
                  </Card>
                </Pulse>
                <View style={{ ...ROW, gap: 6, justifyContent: "center", paddingHorizontal: spacing.md }}>
                  <Ionicons name="notifications-outline" size={14} color={colors.faint} />
                  <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, flexShrink: 1, textAlign: "center" }]}>
                    {t("notifyProsHint")}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, lineHeight: 18 }]}>
                  {t("quotesCompareHint")}
                </Text>
                {pendingOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    busy={busyOfferId === offer.id}
                    disabled={busyOfferId !== null && busyOfferId !== offer.id}
                    onAccept={acceptOffer}
                    onDecline={declineOffer}
                  />
                ))}
              </View>
            )}

            {/* declined quotes stay visible (collapsed) — a quote that simply
                disappeared would read as a bug */}
            {declinedOffers.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
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
                              style={{ color: colors.faint, fontSize: 13, textDecorationLine: "line-through" }}
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
          </View>
        ) : null}

        {/* assigned professional, before contact unlocks (direct bookings) */}
        {showPlainProCard ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("proSectionTitle")} />
            <Card style={{ gap: spacing.md }}>
              <Pressable
                onPress={() => (booking.professional_id ? router.push(`/pro/${booking.professional_id}` as never) : null)}
                style={{ ...ROW, gap: 12 }}
              >
                <Avatar uri={pro?.profile?.avatar_url} name={proName} size={50} />
                <View style={{ flex: 1 }}>
                  <View style={{ ...ROW, gap: 6 }}>
                    <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
                      {proName || t("quoteUnknownPro")}
                    </Text>
                    {pro?.verification_status === "approved" ? (
                      <MaterialCommunityIcons name="check-decagram" size={15} color={colors.info} />
                    ) : null}
                  </View>
                  <View style={{ ...ROW, gap: 6 }}>
                    <StarRating rating={pro?.rating_avg ?? 0} size={13} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {(pro?.rating_avg ?? 0).toFixed(1)} ({pro?.rating_count ?? 0})
                    </Text>
                  </View>
                </View>
              </Pressable>
              <Button title={t("message")} icon="chat" small loading={chatLoading} onPress={openChat} />
            </Card>
          </View>
        ) : null}

        {/* details */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title={t("detailsTitle")} />
          <Card style={{ gap: spacing.md }}>
            <View style={{ ...ROW, gap: 8 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.md,
                  backgroundColor: colors.brandTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons
                  name={(booking.category?.icon as MCIName) ?? "tools"}
                  size={18}
                  color={colors.brand}
                />
              </View>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 }]}>
                {booking.title || (booking.category ? loc(booking.category, "name") : t("category"))}
              </Text>
            </View>

            {/* how soon it's needed */}
            <View style={{ ...ROW, gap: 6 }}>
              <Badge
                label={booking.urgency === "same_day" ? t("quoteUrgencyUrgent") : t("quoteUrgencyScheduled")}
                tone={booking.urgency === "same_day" ? "danger" : "info"}
              />
            </View>

            {booking.description ? (
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 20 }]}>
                {booking.description}
              </Text>
            ) : null}
            {booking.photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[...booking.photos].reverse().map((uri) => (
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
            {booking.address || booking.city || (booking.lat != null && booking.lng != null) ? (
              <View style={{ ...ROW, gap: 6, alignItems: "flex-start" }}>
                <Ionicons name="location-outline" size={16} color={colors.faint} style={{ marginTop: 2 }} />
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, flex: 1 }]}>
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
            <View style={{ ...ROW, gap: 6 }}>
              <Ionicons name="time-outline" size={16} color={colors.faint} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {t("scheduledFor")}: {booking.scheduled_at ? formatDateTime(booking.scheduled_at, lang) : t("asap")}
              </Text>
            </View>

            {/* money summary: agreed range / final price, plus the request fee.
                A zero fee renders nothing — "₪0" would only confuse. */}
            {priceText || serviceFee > 0 ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: spacing.md,
                  gap: 8,
                }}
              >
                {priceText ? (
                  <>
                    <View style={{ ...ROW, justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{priceLabel}</Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={{ color: colors.brand, fontSize: 19, fontWeight: "800", flexShrink: 1 }}
                      >
                        {priceText}
                      </Text>
                    </View>
                    <View style={{ ...ROW, gap: 6 }}>
                      <Badge label={t("cash")} tone="success" />
                      <Text style={{ color: colors.faint, fontSize: 12, flexShrink: 1 }}>
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
            ) : null}
          </Card>
        </View>

        {/* given rating (readonly) — shown as soon as the review row exists,
            even if the trigger hasn't flipped the status to 'rated' yet */}
        {review ? (
          <Card style={{ ...ROW, justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: "700" }}>{t("yourRating")}</Text>
            <StarRating rating={review.rating} size={20} />
          </Card>
        ) : null}

        {/* actions */}
        <View style={{ gap: spacing.md }}>
          {booking.status === "completed" && booking.professional_id && !review ? (
            <Button title={t("rateService")} icon="star" onPress={() => setRateVisible(true)} />
          ) : null}
          {canCancel ? (
            <Pressable
              onPress={() => setCancelVisible(true)}
              style={({ pressed }) => ({
                ...ROW,
                justifyContent: "center",
                gap: 8,
                borderWidth: 1.5,
                borderColor: colors.danger,
                borderRadius: radius.md,
                paddingVertical: 13,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
              <Text style={{ color: colors.danger, fontSize: 15, fontWeight: "700" }}>{t("cancelBooking")}</Text>
            </Pressable>
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
          <Button
            title={t("reportProblem")}
            variant="ghost"
            icon="alert-circle-outline"
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

      {/* cancel confirm modal */}
      <Modal visible={cancelVisible} transparent animationType="fade" onRequestClose={() => setCancelVisible(false)}>
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
              {t("cancelBooking")}
            </Text>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5 }]}>{t("cancelConfirm")}</Text>
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
        </View>
      </Modal>

      {/* fullscreen photo viewer */}
      <Modal visible={viewerUri !== null} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
          <Pressable
            onPress={() => setViewerUri(null)}
            hitSlop={12}
            style={{ position: "absolute", top: insets.top + 12, right: 20, zIndex: 2 }}
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
