// Pro dashboard — availability, and the open-request feed the pro quotes on.
// Customers no longer pick a professional: they post a request, every pro in the
// trade is invited, and the quote is a PRICE RANGE + arrival time.
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
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
  SkeletonList,
} from "../../components/ui";
import { useToast } from "../../components/Toast";
import type { Booking, BookingUrgency, Offer, OfferStatus } from "../../lib/types";

const ETA_PRESETS = [30, 60, 90, 120];

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
          .select("*, category:categories(*), customer:profiles!bookings_customer_id_fkey(*), city:cities(*)")
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

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`pro-dashboard-${uid}`)
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

  if (!isPro || !professional || !uid) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg }}>
        <EmptyState icon="briefcase-outline" title={t("proGateTitle")} subtitle={t("proGateSubtitle")} />
        <Button title={t("proGateCta")} icon="briefcase-plus" onPress={() => router.push("/become-pro")} />
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
            style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.chip }}
            contentFit="cover"
          />
        ))}
      </View>
    ) : null;

  // urgent has to be impossible to miss in a scanned feed
  const renderUrgency = (urgency: BookingUrgency) => {
    const urgent = urgency === "same_day";
    return (
      <View
        style={{
          ...ROW,
          gap: 4,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: radius.full,
          backgroundColor: urgent ? colors.dangerTint : colors.chip,
          borderWidth: urgent ? 1.5 : 1,
          borderColor: urgent ? colors.danger : colors.border,
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
            fontWeight: urgent ? "800" : "600",
          }}
        >
          {t(urgent ? "quoteUrgent" : "quoteScheduled")}
        </Text>
      </View>
    );
  };

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
        {/* availability — big switch-style pill */}
        <Card style={{ gap: spacing.md }}>
          <View style={{ ...ROW, gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: available ? colors.successTint : colors.chip,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name={available ? "lightning-bolt" : "power-sleep"}
                size={20}
                color={available ? colors.success : colors.muted}
              />
            </View>
            <View style={{ flexShrink: 1, gap: 2 }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
                {t("availableForWork")}
              </Text>
              {/* today's published working hours — tap to edit */}
              <Pressable onPress={() => router.push("/pro-settings")} hitSlop={6} style={{ ...ROW, gap: 5 }}>
                <Ionicons name="time-outline" size={13} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12.5 }}>
                  {todayHoursLabel(professional.working_hours, lang) ?? t("setHoursHint")}
                </Text>
              </Pressable>
            </View>
          </View>
          <View
            style={{
              ...ROW,
              backgroundColor: colors.chip,
              borderRadius: radius.full,
              padding: 4,
              gap: 4,
            }}
          >
            <Pressable
              onPress={() => !available && toggleAvailable(true)}
              style={{
                flex: 1,
                ...ROW,
                justifyContent: "center",
                gap: 8,
                paddingVertical: 13,
                borderRadius: radius.full,
                backgroundColor: available ? colors.successTint : "transparent",
                borderWidth: available ? 1.5 : 0,
                borderColor: colors.success,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: available ? colors.success : colors.faint,
                }}
              />
              <Text
                style={{
                  color: available ? colors.success : colors.muted,
                  fontSize: 14.5,
                  fontWeight: available ? "800" : "600",
                }}
              >
                {t("available")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => available && toggleAvailable(false)}
              style={{
                flex: 1,
                ...ROW,
                justifyContent: "center",
                gap: 8,
                paddingVertical: 13,
                borderRadius: radius.full,
                backgroundColor: !available ? colors.card : "transparent",
                borderWidth: !available ? 1.5 : 0,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.faint,
                }}
              />
              <Text
                style={{
                  color: !available ? colors.text : colors.muted,
                  fontSize: 14.5,
                  fontWeight: !available ? "800" : "600",
                }}
              >
                {t("unavailable")}
              </Text>
            </Pressable>
          </View>
          {!available ? (
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5 }]}>
              {t("availabilityOffHint")}
            </Text>
          ) : null}
        </Card>

        {/* compact stats row */}
        <View style={{ ...ROW, gap: spacing.md, alignItems: "stretch" }}>
          {(
            [
              { key: "statOpenNow", value: openReqs.length, icon: "radar" as const },
              { key: "statPendingOffers", value: pendingOffersCount, icon: "send-clock" as const },
              { key: "statActiveJobs", value: activeJobsCount, icon: "hammer-wrench" as const },
            ] as const
          ).map((s) => (
            <View
              key={s.key}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.sm,
                alignItems: "center",
                gap: 4,
                ...shadows.card,
              }}
            >
              <MaterialCommunityIcons name={s.icon} size={16} color={colors.brand} />
              <Text style={{ color: colors.brand, fontSize: 20, fontWeight: "800" }}>{s.value}</Text>
              <Text
                numberOfLines={1}
                style={{ color: colors.muted, fontSize: 10.5, fontWeight: "600", textAlign: "center" }}
              >
                {t(s.key)}
              </Text>
            </View>
          ))}
        </View>

        {/* open requests — the whole job of this screen */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title={t("openRequestsTitle")} />
          {openReqs.length === 0 ? (
            <EmptyState icon="radar" title={t("noOpenRequests")} subtitle={t("noOpenRequestsHint")} />
          ) : (
            openReqs.map((b) => {
              const mine = myOffers[b.id];
              const urgent = b.urgency === "same_day";
              return (
                <Card
                  key={b.id}
                  style={
                    urgent
                      ? { gap: 10, borderWidth: 1.5, borderColor: colors.danger }
                      : { gap: 10 }
                  }
                >
                  <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                    <View style={{ ...ROW, gap: 8, flexShrink: 1 }}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: radius.md,
                          backgroundColor: urgent ? colors.dangerTint : colors.brandTint,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={(b.category?.icon as any) ?? "tools"}
                          size={20}
                          color={urgent ? colors.danger : colors.brand}
                        />
                      </View>
                      <View style={{ flexShrink: 1, gap: 2 }}>
                        <Text
                          numberOfLines={1}
                          style={[RTL_TEXT, { color: colors.text, fontSize: 14.5, fontWeight: "800" }]}
                        >
                          {b.category ? loc(b.category, "name") : b.title}
                        </Text>
                        <View style={{ ...ROW, gap: 8 }}>
                          {b.city ? (
                            <View style={{ ...ROW, gap: 3 }}>
                              <Ionicons name="location-outline" size={12} color={colors.faint} />
                              <Text style={{ color: colors.faint, fontSize: 12 }}>{loc(b.city, "name")}</Text>
                            </View>
                          ) : null}
                          <Text style={{ color: colors.faint, fontSize: 12 }}>
                            {formatTime(b.created_at, lang)}
                          </Text>
                          {b.photos.length ? (
                            <View style={{ ...ROW, gap: 3 }}>
                              <Ionicons name="images-outline" size={12} color={colors.faint} />
                              <Text style={{ color: colors.faint, fontSize: 12 }}>
                                {t("photosCount", { count: b.photos.length })}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                    {renderUrgency(b.urgency)}
                  </View>

                  {b.title || b.description ? (
                    <Text numberOfLines={2} style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>
                      {b.title ? `${b.title}${b.description ? " — " : ""}` : ""}
                      {b.description}
                    </Text>
                  ) : null}

                  {b.scheduled_at ? (
                    <View style={{ ...ROW, gap: 6 }}>
                      <Ionicons name="calendar-outline" size={14} color={colors.brand} />
                      <Text style={[RTL_TEXT, { color: colors.text, fontSize: 12.5, flexShrink: 1 }]}>
                        {t("quotePreferredTime")}: {formatDateTime(b.scheduled_at, lang)}
                      </Text>
                    </View>
                  ) : null}

                  {renderPhotosStrip(b.photos)}

                  {mine ? (
                    <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                      <View style={{ ...ROW, gap: 6, flexShrink: 1 }}>
                        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
                          {t("yourOffer")}:
                        </Text>
                        <Text style={{ color: colors.brand, fontSize: 15, fontWeight: "800" }}>
                          {quoteRangeLabel(mine)}
                        </Text>
                        {mine.eta_minutes != null ? (
                          <Text style={{ color: colors.faint, fontSize: 12 }}>
                            {mine.eta_minutes} {t("minutesShort")}
                          </Text>
                        ) : null}
                      </View>
                      <Badge label={t(OFFER_STATUS_KEY[mine.status])} tone={OFFER_STATUS_TONE[mine.status]} />
                    </View>
                  ) : (
                    <Button title={t("sendOffer")} icon="send" small onPress={() => openQuoteSheet(b)} />
                  )}
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* quote bottom sheet — a price RANGE, an arrival time, an optional note */}
      <Modal visible={!!quoteFor} transparent animationType="slide" onRequestClose={() => setQuoteFor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setQuoteFor(null)} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: "85%" }}
            contentContainerStyle={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
              gap: spacing.lg,
            }}
          >
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>
                {t("sendOffer")}
              </Text>
              <Pressable onPress={() => setQuoteFor(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            {quoteFor ? (
              <View style={{ ...ROW, gap: 8, flexWrap: "wrap" }}>
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>
                  {quoteFor.category ? loc(quoteFor.category, "name") : quoteFor.title}
                  {quoteFor.city ? ` · ${loc(quoteFor.city, "name")}` : ""}
                </Text>
                {renderUrgency(quoteFor.urgency)}
              </View>
            ) : null}

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
                  />
                </View>
              </View>
              {priceError ? (
                <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{priceError}</Text>
              ) : (
                <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{t("quoteRangeHint")}</Text>
              )}
            </View>

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
                />
              ) : null}
            </View>

            <Input
              label={`${t("offerMessageLabel")} (${t("optional")})`}
              placeholder={t("offerMessagePlaceholder")}
              value={quoteMsg}
              onChangeText={setQuoteMsg}
              multiline
              style={{ minHeight: 70, textAlignVertical: "top" }}
            />

            <Button title={t("send")} icon="send" loading={sending} onPress={submitQuote} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
