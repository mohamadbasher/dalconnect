// Pro dashboard — availability, and the open-request feed the pro quotes on.
// Customers no longer pick a professional: they post a request, every pro in the
// trade is invited, and the quote is a PRICE RANGE + arrival time.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextStyle,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme, radius, spacing, formatPrice } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { channelTopic } from "../../lib/realtime";
import { formatDateTime, formatTime } from "../../lib/format";
import { todayHoursLabel } from "../../lib/hours";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  SectionHeader,
  SheetHandle,
  SkeletonList,
  pressCard,
} from "../../components/ui";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useToast } from "../../components/Toast";
import type { Booking, BookingUrgency, Offer, OfferStatus } from "../../lib/types";
import { PROFILE_FIELDS } from "../../lib/queries";
import { ProApprovalGate } from "../../components/ProApprovalGate";

const ETA_PRESETS = [30, 60, 90, 120];

/** Money is written in Latin digits — force LTR so "₪250 – ₪400" never flips. */
const LTR: TextStyle = { writingDirection: "ltr" };

const OFFER_STATUS_KEY: Record<OfferStatus, string> = {
  pending: "offerPending",
  accepted: "offerAccepted",
  rejected: "offerRejected",
  withdrawn: "offerWithdrawn",
};
const OFFER_STATUS_TONE: Record<OfferStatus, "gold" | "success" | "danger" | "neutral"> = {
  pending: "gold",
  accepted: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

/** A quote is a range; old rows may still carry a single `price`. */
function quoteRangeLabel(o: Pick<Offer, "price_min" | "price_max" | "price">): string {
  const min = o.price_min ?? o.price;
  const max = o.price_max ?? o.price;
  if (min == null && max == null) return "—";
  if (min == null) return formatPrice(max as number);
  if (max == null || max === min) return formatPrice(min);
  return `${formatPrice(min)} – ${formatPrice(max)}`;
}

export default function DashboardScreen() {
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session, isPro, professional } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [available, setAvailable] = useState(professional?.is_available ?? true);
  const [openReqs, setOpenReqs] = useState<Booking[]>([]);
  /**
   * Jobs whose quote was just accepted.
   *
   * Winning work used to make the card silently vanish from this list — correct
   * as data (it stopped being an open request) and awful as feedback: the one
   * moment worth celebrating looked identical to losing the job to someone
   * else. They stay here, transformed, until acknowledged.
   */
  const [wonJobs, setWonJobs] = useState<Booking[]>([]);
  const [seenWon, setSeenWon] = useState<string[]>([]);
  const [myOffers, setMyOffers] = useState<Record<string, Offer>>({});
  const [pendingOffersCount, setPendingOffersCount] = useState(0);
  const [activeJobsCount, setActiveJobsCount] = useState(0);

  // quote sheet state
  const [quoteFor, setQuoteFor] = useState<Booking | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [priceError, setPriceError] = useState<string | undefined>();
  const [eta, setEta] = useState<number>(60);
  const [customEta, setCustomEta] = useState("");
  const [useCustomEta, setUseCustomEta] = useState(false);
  const [quoteMsg, setQuoteMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setAvailable(professional?.is_available ?? true);
  }, [professional?.is_available]);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const { data: pcs } = await supabase
        .from("professional_categories")
        .select("category_id")
        .eq("professional_id", uid);
      const catIds = (pcs ?? []).map((r: any) => r.category_id as number);

      let open: Booking[] = [];
      if (catIds.length) {
        const { data: openData } = await supabase
          .from("bookings")
          .select(`*, category:categories(*), customer:profiles!bookings_customer_id_fkey(${PROFILE_FIELDS}), city:cities(*)`)
          .eq("status", "open")
          .in("category_id", catIds)
          .neq("customer_id", uid)
          .order("created_at", { ascending: false })
          .limit(50);
        open = (openData as unknown as Booking[]) ?? [];
      }
      // urgent requests jump the queue; within the same urgency, newest first
      open.sort((a, b) => {
        const au = a.urgency === "same_day" ? 0 : 1;
        const bu = b.urgency === "same_day" ? 0 : 1;
        if (au !== bu) return au - bu;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setOpenReqs(open);

      // Jobs I've just won. Fetched alongside the open list so the card can
      // stay in place rather than disappearing the instant it's accepted.
      const { data: wonData } = await supabase
        .from("bookings")
        .select(`*, category:categories(*), customer:profiles!bookings_customer_id_fkey(${PROFILE_FIELDS}), city:cities(*)`)
        .eq("professional_id", uid)
        .eq("status", "accepted")
        .order("accepted_at", { ascending: false })
        .limit(10);
      setWonJobs((wonData as unknown as Booking[]) ?? []);

      const ids = open.map((b) => b.id);
      if (ids.length) {
        const { data: offerData } = await supabase
          .from("offers")
          .select("*")
          .eq("professional_id", uid)
          .in("booking_id", ids);
        const map: Record<string, Offer> = {};
        for (const o of (offerData as unknown as Offer[]) ?? []) map[o.booking_id] = o;
        setMyOffers(map);
      } else {
        setMyOffers({});
      }

      // compact stats: my quotes awaiting an answer + jobs currently running
      const [{ count: offersCount }, { count: activeCount }] = await Promise.all([
        supabase
          .from("offers")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", uid)
          .eq("status", "pending"),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", uid)
          .in("status", ["accepted", "on_the_way", "in_progress"]),
      ]);
      setPendingOffersCount(offersCount ?? 0);
      setActiveJobsCount(activeCount ?? 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const SEEN_WON_KEY = "dalconnect.seenWonJobs";
  useEffect(() => {
    AsyncStorage.getItem(SEEN_WON_KEY)
      .then((raw: string | null) => setSeenWon(raw ? (JSON.parse(raw) as string[]) : []))
      .catch(() => setSeenWon([]));
  }, []);

  /** acknowledged — stop showing the celebration card for this job */
  const dismissWon = useCallback(
    (id: string) => {
      setSeenWon((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id].slice(-50); // a cap, not a leak
        AsyncStorage.setItem(SEEN_WON_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  // The cards worth showing: won, and not yet acknowledged.
  const freshWins = wonJobs.filter((b) => !seenWon.includes(b.id));

  /**
   * Announce a win the moment it happens.
   *
   * The realtime handler below already refetches on any booking change, so "an
   * id appeared in freshWins that wasn't there before" is the signal — no extra
   * subscription, and it fires whether the news arrived by websocket or by
   * pull-to-refresh. The first pass only seeds: a job that was already accepted
   * when the screen opened is not news.
   */
  const announcedRef = useRef<Set<string> | null>(null);
  const freshWinKey = freshWins.map((b) => b.id).join(",");
  useEffect(() => {
    const ids = new Set(freshWins.map((b) => b.id));
    if (announcedRef.current === null) {
      announcedRef.current = ids;
      return;
    }
    // one toast even if two land together — this is a nudge, not a log
    if ([...ids].some((id) => !announcedRef.current!.has(id))) {
      toast.success(t("offerAcceptedToastPro"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    announcedRef.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshWinKey]);

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(channelTopic(`pro-dashboard-${uid}`))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings" }, () => load())
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers", filter: `professional_id=eq.${uid}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, load]);

  // Approved professionals only. The database already refuses to show them
  // open work or accept a quote (migration 20260714000017); without this the
  // refusal would just look like an empty screen and a broken app.
  if (professional && professional.verification_status !== "approved") {
    return <ProApprovalGate status={professional.verification_status} />;
  }

  if (!isPro || !professional || !uid) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg, gap: spacing.lg }}>
        <EmptyState icon="briefcase-outline" title={t("proGateTitle")} subtitle={t("proGateSubtitle")} />
      </View>
    );
  }

  const toggleAvailable = async (v: boolean) => {
    setAvailable(v); // optimistic
    const { error } = await supabase.from("professionals").update({ is_available: v }).eq("id", uid);
    if (error) {
      setAvailable(!v);
      toast.error(t("error"));
    } else {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const openQuoteSheet = (b: Booking) => {
    setQuoteFor(b);
    setPriceMin("");
    setPriceMax("");
    setPriceError(undefined);
    setEta(60);
    setCustomEta("");
    setUseCustomEta(false);
    setQuoteMsg("");
  };

  const submitQuote = async () => {
    if (!quoteFor) return;
    const min = parseFloat(priceMin.replace(",", "."));
    const max = parseFloat(priceMax.replace(",", "."));
    if (!priceMin.trim() || !priceMax.trim()) {
      setPriceError(t("quoteRangeRequired"));
      return;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
      setPriceError(t("quoteRangeInvalid"));
      return;
    }
    if (min > max) {
      setPriceError(t("quoteRangeOrder"));
      return;
    }
    let etaVal: number | null = eta;
    if (useCustomEta) {
      const n = parseInt(customEta, 10);
      etaVal = Number.isFinite(n) && n > 0 ? n : null;
    }
    setSending(true);
    // `price` is the legacy nullable column — quotes are ranges now, don't send it
    const { error } = await supabase.from("offers").insert({
      booking_id: quoteFor.id,
      professional_id: uid,
      price_min: min,
      price_max: max,
      eta_minutes: etaVal,
      message: quoteMsg.trim(),
    });
    setSending(false);
    if (error) {
      if ((error as any).code === "23505") {
        setQuoteFor(null);
        toast.info(t("alreadyOffered"));
        load();
      } else {
        toast.error(t("error"));
      }
    } else {
      setQuoteFor(null);
      toast.success(t("offerSent"));
      load();
    }
  };

  if (loading) return <SkeletonList count={4} />;

  const renderPhotosStrip = (photos: string[]) =>
    photos.length ? (
      <View style={{ ...ROW, gap: 6 }}>
        {photos.slice(0, 4).map((p, i) => (
          <Image
            key={i}
            source={{ uri: p }}
            style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.chip }}
            contentFit="cover"
          />
        ))}
      </View>
    ) : null;

  // One accent, not three: urgent requests wear a danger-tinted pill and nothing
  // else — the feed stays calm and the pill still jumps out when scanning.
  const renderUrgency = (urgency: BookingUrgency) => {
    const urgent = urgency === "same_day";
    return (
      <View
        style={{
          ...ROW,
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.full,
          backgroundColor: urgent ? colors.dangerTint : colors.chip,
        }}
      >
        <MaterialCommunityIcons
          name={urgent ? "lightning-bolt" : "calendar-clock"}
          size={12}
          color={urgent ? colors.danger : colors.muted}
        />
        <Text
          style={{
            color: urgent ? colors.danger : colors.muted,
            fontSize: 11.5,
            fontWeight: "700",
          }}
        >
          {t(urgent ? "quoteUrgent" : "quoteScheduled")}
        </Text>
      </View>
    );
  };

  const metaDot = (icon: keyof typeof Ionicons.glyphMap, label: string) => (
    <View style={{ ...ROW, gap: 3 }}>
      <Ionicons name={icon} size={12} color={colors.faint} />
      <Text style={{ color: colors.faint, fontSize: 12 }}>{label}</Text>
    </View>
  );

  const stats = [
    { key: "statOpenNow", value: openReqs.length },
    { key: "statPendingOffers", value: pendingOffersCount },
    { key: "statActiveJobs", value: activeJobsCount },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* ---------- availability: one calm switch ---------- */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <View style={{ ...ROW, gap: spacing.md, padding: spacing.lg }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: radius.full,
                backgroundColor: available ? colors.successTint : colors.chip,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name={available ? "lightning-bolt" : "power-sleep"}
                size={21}
                color={available ? colors.success : colors.muted}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
                {t("availableForWork")}
              </Text>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, lineHeight: 18 }]}>
                {t(available ? "availabilityOnHint" : "availabilityOffHint")}
              </Text>
            </View>
            <Switch
              value={available}
              onValueChange={toggleAvailable}
              trackColor={{ false: colors.chip, true: colors.success }}
              thumbColor={colors.card}
              ios_backgroundColor={colors.chip}
            />
          </View>

          {/* today's published working hours — tap to edit */}
          <Pressable
            onPress={() => router.push("/pro-settings")}
            style={({ pressed }) => ({
              ...ROW,
              gap: 8,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="time-outline" size={15} color={colors.muted} />
            <Text style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 12.5 }]}>
              {todayHoursLabel(professional.working_hours, lang) ?? t("setHoursHint")}
            </Text>
            <Ionicons name="chevron-back" size={16} color={colors.faint} />
          </Pressable>
        </Card>

        {/* ---------- compact stats, one card ---------- */}
        <View
          style={{
            ...ROW,
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            paddingVertical: spacing.md,
            ...shadows.card,
          }}
        >
          {stats.map((s, i) => (
            <View
              key={s.key}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 2,
                paddingHorizontal: spacing.xs,
                borderLeftWidth: i < stats.length - 1 ? 1 : 0,
                borderLeftColor: colors.hairline,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>{s.value}</Text>
              <Text
                numberOfLines={1}
                style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "center" }}
              >
                {t(s.key)}
              </Text>
            </View>
          ))}
        </View>

        {/* ---------- jobs just won ----------
             These sit where the request card was, rather than the card simply
             vanishing. Winning and being passed over used to look identical:
             the row disappeared either way. They stay until tapped. */}
        {freshWins.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            {freshWins.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => {
                  dismissWon(b.id);
                  router.push(`/job/${b.id}` as never);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.successTint,
                    borderRadius: radius.lg,
                    borderWidth: 1.5,
                    borderColor: colors.success,
                    padding: spacing.lg,
                    gap: spacing.md,
                  },
                  pressed ? pressCard : null,
                ]}
              >
                <View style={{ ...ROW, alignItems: "center", gap: spacing.md }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: radius.md,
                      backgroundColor: colors.success,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="checkmark" size={22} color={colors.onBrand} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[RTL_TEXT, { color: colors.success, fontSize: 15.5, fontWeight: "800" }]}>
                      {t("wonJobTitle")}
                    </Text>
                    <Text numberOfLines={2} style={[RTL_TEXT, { color: colors.success, fontSize: 12.5, lineHeight: 18 }]}>
                      {t("wonJobBody")}
                    </Text>
                  </View>
                </View>

                {/* which job, so a provider holding three of these can tell them apart */}
                <View style={{ ...ROW, alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 13.5, fontWeight: "700" }]}>
                    {b.category ? loc(b.category, "name") : b.title}
                  </Text>
                  {b.city ? (
                    <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>· {loc(b.city, "name")}</Text>
                  ) : null}
                  {b.customer?.full_name ? (
                    <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>
                      · {b.customer.full_name}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={{
                    ...ROW,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    backgroundColor: colors.success,
                    borderRadius: radius.md,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "800" }}>
                    {t("wonJobCta")}
                  </Text>
                  <Ionicons name="chevron-back" size={15} color={colors.onBrand} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ---------- open requests — the whole job of this screen ---------- */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title={t("openRequestsTitle")} />
          {openReqs.length === 0 ? (
            <EmptyState icon="radar" title={t("noOpenRequests")} subtitle={t("noOpenRequestsHint")} />
          ) : (
            openReqs.map((b) => {
              const mine = myOffers[b.id];
              return (
                <Card key={b.id} style={{ gap: spacing.md }}>
                  {/* head: trade + where/when, urgency pill on the far side */}
                  <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                    <View style={{ ...ROW, gap: 10, flexShrink: 1 }}>
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: radius.md,
                          backgroundColor: colors.brandTint,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={(b.category?.icon as any) ?? "tools"}
                          size={21}
                          color={colors.brand}
                        />
                      </View>
                      <View style={{ flexShrink: 1, gap: 3 }}>
                        <Text
                          numberOfLines={1}
                          style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800" }]}
                        >
                          {b.category ? loc(b.category, "name") : b.title}
                        </Text>
                        <View style={{ ...ROW, gap: 10, flexWrap: "wrap" }}>
                          {b.city ? metaDot("location-outline", loc(b.city, "name")) : null}
                          {metaDot("time-outline", formatTime(b.created_at, lang))}
                          {b.photos.length
                            ? metaDot("images-outline", t("photosCount", { count: b.photos.length }))
                            : null}
                        </View>
                      </View>
                    </View>
                    {renderUrgency(b.urgency)}
                  </View>

                  {b.title || b.description ? (
                    <Text numberOfLines={2} style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 20 }]}>
                      {b.title ? `${b.title}${b.description ? " — " : ""}` : ""}
                      {b.description}
                    </Text>
                  ) : null}

                  {b.scheduled_at ? (
                    <View style={{ ...ROW, gap: 6 }}>
                      <Ionicons name="calendar-outline" size={14} color={colors.brand} />
                      <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5 }]}>
                        {t("quotePreferredTime")}
                      </Text>
                      {/* localized date: Arabic/Hebrew words with digit runs — RTL text */}
                      <Text style={[RTL_TEXT, { color: colors.text, fontSize: 12.5, fontWeight: "700", flexShrink: 1 }]}>
                        {formatDateTime(b.scheduled_at, lang)}
                      </Text>
                    </View>
                  ) : null}

                  {renderPhotosStrip(b.photos)}

                  {mine ? (
                    <View
                      style={{
                        ...ROW,
                        justifyContent: "space-between",
                        gap: 8,
                        backgroundColor: colors.brandTint,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm + 2,
                      }}
                    >
                      <View style={{ ...ROW, gap: 8, flexShrink: 1 }}>
                        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>
                          {t("yourOffer")}
                        </Text>
                        <Text style={[LTR, { color: colors.brand, fontSize: 15, fontWeight: "800" }]}>
                          {quoteRangeLabel(mine)}
                        </Text>
                        {mine.eta_minutes != null ? (
                          <Text style={[LTR, { color: colors.faint, fontSize: 12 }]}>
                            {`${mine.eta_minutes} ${t("minutesShort")}`}
                          </Text>
                        ) : null}
                      </View>
                      <Badge label={t(OFFER_STATUS_KEY[mine.status])} tone={OFFER_STATUS_TONE[mine.status]} />
                    </View>
                  ) : (
                    <Button title={t("sendOffer")} icon="send" onPress={() => openQuoteSheet(b)} />
                  )}
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ---------- quote sheet: a price RANGE, an arrival time, an optional note ---------- */}
      {/* Quote sheet.
          Two things this gets right that the previous version didn't:
          the overlay and `justifyContent: "flex-end"` live on the
          KeyboardAvoidingView, so the sheet is pinned to the bottom edge
          instead of floating with the page showing beneath it; and the
          scrolling happens INSIDE a fixed sheet container rather than the
          ScrollView being the sheet, which is what let its height wander.
          Same structure as every other bottom sheet in the app. */}
      <Modal visible={!!quoteFor} transparent animationType="slide" onRequestClose={() => setQuoteFor(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setQuoteFor(null)} />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              maxHeight: "88%",
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: spacing.lg,
                paddingBottom: spacing.xl,
                gap: spacing.lg,
              }}
            >
            <SheetHandle />

            {/* Row is row-reverse, so the FIRST child sits on the right — which
                is where a close button belongs in an RTL sheet, and where every
                other screen's back/close control already is. */}
            <View style={{ ...ROW, gap: spacing.md, alignItems: "flex-start" }}>
              <Pressable onPress={() => setQuoteFor(null)} hitSlop={10} style={{ paddingTop: 2 }}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
              {/* flex, not space-between: the title should sit beside the close
                  button, not get flung to the opposite edge of the sheet */}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[RTL_TEXT, { color: colors.text, fontSize: 18, fontWeight: "800" }]}>
                  {t("sendOffer")}
                </Text>
                {quoteFor ? (
                  <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>
                    {quoteFor.category ? loc(quoteFor.category, "name") : quoteFor.title}
                    {quoteFor.city ? ` · ${loc(quoteFor.city, "name")}` : ""}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* price range */}
            <View style={{ gap: 6 }}>
              <View style={{ ...ROW, gap: spacing.md, alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t("quoteMinLabel")}
                    placeholder={t("quoteMinPlaceholder")}
                    keyboardType="numeric"
                    value={priceMin}
                    onChangeText={(v) => {
                      setPriceMin(v);
                      setPriceError(undefined);
                    }}
                    style={LTR}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t("quoteMaxLabel")}
                    placeholder={t("quoteMaxPlaceholder")}
                    keyboardType="numeric"
                    value={priceMax}
                    onChangeText={(v) => {
                      setPriceMax(v);
                      setPriceError(undefined);
                    }}
                    style={LTR}
                  />
                </View>
              </View>
              {priceError ? (
                <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{priceError}</Text>
              ) : (
                <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, lineHeight: 18 }]}>
                  {t("quoteRangeHint")}
                </Text>
              )}
            </View>

            {/* arrival time */}
            <View style={{ gap: 8 }}>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, fontWeight: "600" }]}>
                {t("offerEtaLabel")}
              </Text>
              <View style={{ ...ROW, gap: 8, flexWrap: "wrap" }}>
                {ETA_PRESETS.map((m) => (
                  <Chip
                    key={m}
                    label={`${m} ${t("minutesShort")}`}
                    active={!useCustomEta && eta === m}
                    onPress={() => {
                      setUseCustomEta(false);
                      setEta(m);
                    }}
                  />
                ))}
                <Chip label={t("etaCustom")} active={useCustomEta} onPress={() => setUseCustomEta(true)} />
              </View>
              {useCustomEta ? (
                <Input
                  placeholder={t("etaMinutesPlaceholder")}
                  keyboardType="numeric"
                  value={customEta}
                  onChangeText={setCustomEta}
                  style={LTR}
                />
              ) : null}
            </View>

            <Input
              label={`${t("offerMessageLabel")} · ${t("optional")}`}
              placeholder={t("offerMessagePlaceholder")}
              value={quoteMsg}
              onChangeText={setQuoteMsg}
              multiline
              style={{ minHeight: 74, textAlignVertical: "top" }}
            />

            <Button title={t("send")} icon="send" loading={sending} onPress={submitQuote} />
            </ScrollView>
            {/* the home-indicator gap belongs to the sheet, not to the scrolling
                content — otherwise it scrolls away with everything else */}
            <View style={{ height: insets.bottom }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
