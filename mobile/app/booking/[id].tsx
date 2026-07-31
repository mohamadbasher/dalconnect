// Booking detail — customer view. Live status timeline, offers (while open),
// professional card once assigned, details, and status-driven actions.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, radius, spacing, formatPrice } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { getOrCreateConversation } from "../../lib/chat";
import { formatDateTime, STATUS_KEY } from "../../lib/format";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Avatar, Badge, Button, Card, EmptyState, Input, Loading, SectionHeader, StarRating } from "../../components/ui";
import { RateModal } from "../../components/RateModal";
import type { Booking, BookingStatus, Offer, Review } from "../../lib/types";

type MCIName = keyof typeof MaterialCommunityIcons.glyphMap;

const STEP_ICONS: MCIName[] = ["bullhorn", "check-bold", "truck-fast", "progress-wrench", "flag-checkered"];

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

/** subtle looping opacity pulse for the "waiting for offers" state */
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
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
      .select("*, category:categories(*), city:cities(*), professional:professionals(*, profile:profiles!professionals_id_fkey(*))")
      .eq("id", id)
      .maybeSingle();
    const b = (data as unknown as Booking | null) ?? null;
    setBooking(b);
    if (b?.status === "open") {
      const { data: offs } = await supabase
        .from("offers")
        .select("*, professional:professionals(*, profile:profiles!professionals_id_fkey(*))")
        .eq("booking_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      setOffers((offs as unknown as Offer[]) ?? []);
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
      .channel(`booking-detail-${id}`)
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const acceptOffer = (offer: Offer) => {
    const name = offer.professional?.business_name || offer.professional?.profile?.full_name || "";
    Alert.alert(t("acceptOffer"), t("acceptOfferConfirm", { name, price: formatPrice(offer.price) }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: async () => {
          setAcceptingId(offer.id);
          const { error } = await supabase.rpc("accept_offer", { p_offer_id: offer.id });
          setAcceptingId(null);
          if (error) {
            Alert.alert(t("error"));
            load();
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          load();
        },
      },
    ]);
  };

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
      Alert.alert(t("error"));
      return;
    }
    setCancelReason("");
    load();
  };

  const openChat = async () => {
    if (!booking?.professional_id || !session?.user.id || chatLoading) return;
    setChatLoading(true);
    try {
      const convId = await getOrCreateConversation(booking.customer_id, booking.professional_id);
      router.push(`/chat/${convId}` as never);
    } catch {
      Alert.alert(t("error"));
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
  const proName = pro ? pro.business_name || pro.profile?.full_name || "" : "";
  const proPhone = pro?.profile?.phone ?? "";
  const canCancel = booking.status === "open" || booking.status === "pending" || booking.status === "accepted";
  const showProCard = pro !== null && booking.status !== "open";

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
            <Card style={{ gap: 0 }}>
              {steps.map((s, i) => {
                const done = i <= currentIdx;
                const isLast = i === steps.length - 1;
                return (
                  <View key={s} style={{ ...ROW, gap: 12, alignItems: "flex-start" }}>
                    <View style={{ alignItems: "center" }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          backgroundColor: done ? colors.brand : colors.chip,
                          alignItems: "center",
                          justifyContent: "center",
                          ...(i === currentIdx ? shadows.cta : null),
                        }}
                      >
                        <MaterialCommunityIcons
                          name={STEP_ICONS[i]}
                          size={17}
                          color={done ? colors.onBrand : colors.faint}
                        />
                      </View>
                      {!isLast ? (
                        <View
                          style={{
                            width: 2.5,
                            height: 22,
                            borderRadius: 2,
                            backgroundColor: i < currentIdx ? colors.brand : colors.border,
                          }}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        RTL_TEXT,
                        {
                          flex: 1,
                          paddingTop: 7,
                          fontSize: 14.5,
                          fontWeight: i === currentIdx ? "800" : "600",
                          color: done ? colors.text : colors.faint,
                        },
                      ]}
                    >
                      {t(STATUS_KEY[s === "completed" && booking.status === "rated" ? "rated" : s])}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* offers — only while collecting */}
        {booking.status === "open" ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("offersTitle", { n: offers.length })} />
            {offers.length === 0 ? (
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
              offers.map((offer) => {
                const op = offer.professional;
                const opName = op ? op.business_name || op.profile?.full_name || "" : "";
                return (
                  <Card key={offer.id} style={{ gap: spacing.md }}>
                    <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                      <View style={{ ...ROW, gap: 10, flexShrink: 1 }}>
                        <Avatar uri={op?.profile?.avatar_url} name={opName} size={42} />
                        <View style={{ flexShrink: 1 }}>
                          <Text
                            numberOfLines={1}
                            style={[RTL_TEXT, { color: colors.text, fontSize: 14.5, fontWeight: "800" }]}
                          >
                            {opName}
                          </Text>
                          <View style={{ ...ROW, gap: 5 }}>
                            <StarRating rating={op?.rating_avg ?? 0} size={12} />
                            <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                              {(op?.rating_avg ?? 0).toFixed(1)} ({op?.rating_count ?? 0})
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={{ color: colors.brand, fontSize: 19, fontWeight: "800" }}>
                        {formatPrice(offer.price)}
                      </Text>
                    </View>
                    {offer.eta_minutes != null ? (
                      <View style={{ ...ROW }}>
                        <Badge label={t("etaChip", { n: offer.eta_minutes })} tone="info" />
                      </View>
                    ) : null}
                    {offer.message ? (
                      <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, lineHeight: 19 }]}>
                        {offer.message}
                      </Text>
                    ) : null}
                    <View style={{ ...ROW, justifyContent: "space-between" }}>
                      <Pressable onPress={() => router.push(`/pro/${offer.professional_id}` as never)} hitSlop={8}>
                        <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "700" }}>
                          {t("viewProfile")}
                        </Text>
                      </Pressable>
                      <Button
                        title={t("acceptOffer")}
                        small
                        icon="check"
                        loading={acceptingId === offer.id}
                        disabled={acceptingId !== null && acceptingId !== offer.id}
                        onPress={() => acceptOffer(offer)}
                      />
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        ) : null}

        {/* assigned professional */}
        {showProCard ? (
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
                      {proName}
                    </Text>
                    {pro?.verification_status === "approved" ? (
                      <Ionicons name="shield-checkmark" size={15} color={colors.info} />
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
              <View style={{ ...ROW, gap: 10 }}>
                {proPhone ? (
                  <Button
                    title={t("call")}
                    icon="phone"
                    small
                    variant="success"
                    style={{ flex: 1 }}
                    onPress={() => Linking.openURL(`tel:${proPhone}`).catch(() => {})}
                  />
                ) : null}
                <Button
                  title={t("message")}
                  icon="chat"
                  small
                  loading={chatLoading}
                  style={{ flex: 1 }}
                  onPress={openChat}
                />
              </View>
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
            {booking.price != null ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: spacing.md,
                  gap: 6,
                }}
              >
                <View style={{ ...ROW, justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{t("price")}</Text>
                  <Text style={{ color: colors.brand, fontSize: 19, fontWeight: "800" }}>
                    {formatPrice(booking.price)}
                  </Text>
                </View>
                <View style={{ ...ROW, gap: 6 }}>
                  <Badge label={t("cash")} tone="success" />
                  <Text style={{ color: colors.faint, fontSize: 12 }}>{t("cashNote")}</Text>
                </View>
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
