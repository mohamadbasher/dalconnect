// Pro dashboard — availability toggle, incoming direct bookings, nearby open requests.
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import { formatTime } from "../../lib/format";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Badge, Button, Card, Chip, EmptyState, Input, Loading, SectionHeader } from "../../components/ui";
import type { Booking, Offer, OfferStatus } from "../../lib/types";

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

export default function DashboardScreen() {
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session, isPro, professional } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [available, setAvailable] = useState(professional?.is_available ?? true);
  const [direct, setDirect] = useState<Booking[]>([]);
  const [openReqs, setOpenReqs] = useState<Booking[]>([]);
  const [myOffers, setMyOffers] = useState<Record<string, Offer>>({});
  const [pendingOffersCount, setPendingOffersCount] = useState(0);
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);

  // offer modal state
  const [offerFor, setOfferFor] = useState<Booking | null>(null);
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState<string | undefined>();
  const [eta, setEta] = useState<number>(60);
  const [customEta, setCustomEta] = useState("");
  const [useCustomEta, setUseCustomEta] = useState(false);
  const [offerMsg, setOfferMsg] = useState("");
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

      const sel = "*, category:categories(*), customer:profiles!bookings_customer_id_fkey(*), city:cities(*)";
      const { data: directData } = await supabase
        .from("bookings")
        .select(sel)
        .eq("professional_id", uid)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setDirect((directData as unknown as Booking[]) ?? []);

      let open: Booking[] = [];
      if (catIds.length) {
        const { data: openData } = await supabase
          .from("bookings")
          .select(sel)
          .eq("status", "open")
          .in("category_id", catIds)
          .neq("customer_id", uid)
          .order("created_at", { ascending: false })
          .limit(50);
        open = (openData as unknown as Booking[]) ?? [];
      }
      const myCity = professional?.city_id ?? null;
      open.sort((a, b) => {
        const ac = a.city_id != null && a.city_id === myCity ? 0 : 1;
        const bc = b.city_id != null && b.city_id === myCity ? 0 : 1;
        if (ac !== bc) return ac - bc;
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

      // compact stats: my pending offers + jobs currently in progress
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
  }, [uid, professional?.city_id]);

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
        { event: "UPDATE", schema: "public", table: "bookings", filter: `professional_id=eq.${uid}` },
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
      Alert.alert(t("error"));
    } else {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const acceptDirect = async (b: Booking) => {
    setActingId(b.id);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", b.id)
      .eq("status", "pending");
    setActingId(null);
    if (error) Alert.alert(t("error"));
    else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      load();
      router.push(`/job/${b.id}`);
    }
  };

  const rejectDirect = (b: Booking) => {
    Alert.alert(t("rejectConfirmTitle"), t("rejectConfirmMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("reject"),
        style: "destructive",
        onPress: async () => {
          setActingId(b.id);
          const { error } = await supabase
            .from("bookings")
            .update({ status: "rejected" })
            .eq("id", b.id)
            .eq("status", "pending");
          setActingId(null);
          if (error) Alert.alert(t("error"));
          else load();
        },
      },
    ]);
  };

  const openOfferSheet = (b: Booking) => {
    setOfferFor(b);
    setPrice("");
    setPriceError(undefined);
    setEta(60);
    setCustomEta("");
    setUseCustomEta(false);
    setOfferMsg("");
  };

  const submitOffer = async () => {
    if (!offerFor) return;
    const priceNum = parseFloat(price.replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setPriceError(t("invalidPrice"));
      return;
    }
    let etaVal: number | null = eta;
    if (useCustomEta) {
      const n = parseInt(customEta, 10);
      etaVal = Number.isFinite(n) && n > 0 ? n : null;
    }
    setSending(true);
    const { error } = await supabase.from("offers").insert({
      booking_id: offerFor.id,
      professional_id: uid,
      price: priceNum,
      eta_minutes: etaVal,
      message: offerMsg.trim(),
    });
    setSending(false);
    if (error) {
      if ((error as any).code === "23505") {
        setOfferFor(null);
        Alert.alert(t("alreadyOffered"));
        load();
      } else {
        Alert.alert(t("error"));
      }
    } else {
      setOfferFor(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(t("offerSent"));
      load();
    }
  };

  if (loading) return <Loading />;

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
        {photos.length > 4 ? (
          <Text style={{ color: colors.faint, fontSize: 12 }}>+{photos.length - 4}</Text>
        ) : null}
      </View>
    ) : null;

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
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800", flexShrink: 1 }]}>
              {t("availableForWork")}
            </Text>
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

        {/* direct bookings */}
        {direct.length ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("directBookingsTitle")} />
            {direct.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/job/${b.id}`)}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.card,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    gap: 10,
                    ...shadows.card,
                    borderWidth: 1.5,
                    borderColor: colors.brandTint,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                  <View style={{ ...ROW, gap: 8, flexShrink: 1 }}>
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
                        name={(b.category?.icon as any) ?? "tools"}
                        size={20}
                        color={colors.brand}
                      />
                    </View>
                    <View style={{ flexShrink: 1 }}>
                      <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 14.5, fontWeight: "800" }]}>
                        {b.customer?.full_name ?? ""}
                      </Text>
                      <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>
                        {b.category ? loc(b.category, "name") : ""}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.faint, fontSize: 11.5 }}>{formatTime(b.created_at, lang)}</Text>
                </View>
                {b.description ? (
                  <Text numberOfLines={2} style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>
                    {b.description}
                  </Text>
                ) : null}
                <View style={{ ...ROW, justifyContent: "space-between" }}>
                  {renderPhotosStrip(b.photos) ?? <View />}
                  {b.photos.length ? null : (
                    <Text style={{ color: colors.faint, fontSize: 12 }}>
                      {b.scheduled_at ? formatTime(b.scheduled_at, lang) : ""}
                    </Text>
                  )}
                </View>
                <View style={{ ...ROW, gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("accept")}
                      variant="success"
                      small
                      icon="check"
                      loading={actingId === b.id}
                      onPress={() => acceptDirect(b)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("reject")}
                      variant="danger"
                      small
                      icon="close"
                      disabled={actingId === b.id}
                      onPress={() => rejectDirect(b)}
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* open requests */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title={t("openRequestsTitle")} />
          {openReqs.length === 0 ? (
            <EmptyState icon="radar" title={t("noOpenRequests")} subtitle={t("noOpenRequestsHint")} />
          ) : (
            openReqs.map((b) => {
              const mine = myOffers[b.id];
              return (
                <Card key={b.id} style={{ gap: 10 }}>
                  <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                    <View style={{ ...ROW, gap: 8, flexShrink: 1 }}>
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
                          name={(b.category?.icon as any) ?? "tools"}
                          size={20}
                          color={colors.brand}
                        />
                      </View>
                      <View style={{ flexShrink: 1 }}>
                        <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 14.5, fontWeight: "800" }]}>
                          {b.category ? loc(b.category, "name") : b.title}
                        </Text>
                        <View style={{ ...ROW, gap: 6 }}>
                          {b.city ? (
                            <View style={{ ...ROW, gap: 3 }}>
                              <Ionicons name="location-outline" size={12} color={colors.faint} />
                              <Text style={{ color: colors.faint, fontSize: 12 }}>{loc(b.city, "name")}</Text>
                            </View>
                          ) : null}
                          <Text style={{ color: colors.faint, fontSize: 12 }}>
                            {formatTime(b.created_at, lang)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {b.city_id != null && b.city_id === professional.city_id ? (
                      <Badge label={loc(b.city, "name")} tone="brand" />
                    ) : null}
                  </View>

                  {b.title || b.description ? (
                    <Text numberOfLines={2} style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>
                      {b.title ? `${b.title}${b.description ? " — " : ""}` : ""}
                      {b.description}
                    </Text>
                  ) : null}

                  {b.photos.length ? (
                    <View style={{ ...ROW, justifyContent: "space-between" }}>
                      {renderPhotosStrip(b.photos)}
                      <Text style={{ color: colors.faint, fontSize: 11.5 }}>
                        {t("photosCount", { count: b.photos.length })}
                      </Text>
                    </View>
                  ) : null}

                  {mine ? (
                    <View style={{ ...ROW, justifyContent: "space-between" }}>
                      <View style={{ ...ROW, gap: 6 }}>
                        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{t("yourOffer")}:</Text>
                        <Text style={{ color: colors.brand, fontSize: 15, fontWeight: "800" }}>
                          {formatPrice(mine.price)}
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
                    <Button title={t("sendOffer")} icon="send" small onPress={() => openOfferSheet(b)} />
                  )}
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* send-offer bottom sheet */}
      <Modal visible={!!offerFor} transparent animationType="slide" onRequestClose={() => setOfferFor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setOfferFor(null)} />
          <View
            style={{
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
              <Pressable onPress={() => setOfferFor(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            {offerFor?.category ? (
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>
                {loc(offerFor.category, "name")}
                {offerFor.city ? ` · ${loc(offerFor.city, "name")}` : ""}
              </Text>
            ) : null}

            <Input
              label={t("offerPriceLabel")}
              placeholder={t("offerPricePlaceholder")}
              keyboardType="numeric"
              value={price}
              onChangeText={(v) => {
                setPrice(v);
                setPriceError(undefined);
              }}
              error={priceError}
            />

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
              value={offerMsg}
              onChangeText={setOfferMsg}
              multiline
              style={{ minHeight: 70, textAlignVertical: "top" }}
            />

            <Button title={t("send")} icon="send" loading={sending} onPress={submitOffer} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
