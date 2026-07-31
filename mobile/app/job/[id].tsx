// Pro's live view of a booking — customer contact, details, navigation, status advance.
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import * as Haptics from "expo-haptics";
import { useTheme, radius, spacing, formatPrice } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { getOrCreateConversation } from "../../lib/chat";
import { formatDateTime, STATUS_KEY, STATUS_TONE } from "../../lib/format";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Avatar, Badge, Button, Card, EmptyState, Loading, SectionHeader } from "../../components/ui";
import type { Booking, BookingStatus } from "../../lib/types";

const STEPS: BookingStatus[] = ["accepted", "on_the_way", "in_progress", "completed"];
const STEP_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  accepted: "check",
  on_the_way: "truck-fast",
  in_progress: "hammer-wrench",
  completed: "flag-checkered",
};

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = session?.user?.id ?? null;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("bookings")
        .select("*, category:categories(*), customer:profiles!bookings_customer_id_fkey(*), city:cities(*)")
        .eq("id", id)
        .maybeSingle();
      setBooking((data as unknown as Booking) ?? null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`job-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${id}` },
        (payload) => {
          setBooking((prev) => (prev ? { ...prev, ...(payload.new as Partial<Booking>) } : prev));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const setStatus = async (next: BookingStatus, extra?: Record<string, unknown>) => {
    if (!booking || busy) return;
    setBusy(true);
    // optimistic-concurrency guard: only advance from the status we're showing
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: next, ...(extra ?? {}) })
      .eq("id", booking.id)
      .eq("status", booking.status)
      .select("id");
    if (error) {
      setBusy(false);
      Alert.alert(t("error"));
      return;
    }
    if (!data?.length) {
      // status changed elsewhere (e.g. customer cancelled) — resync
      await load();
      setBusy(false);
      return;
    }
    setBooking((prev) => (prev ? { ...prev, status: next, ...(extra as Partial<Booking>) } : prev));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // refetch so trigger-computed fields (commission, completed_at) come through
    await load();
    setBusy(false);
  };

  const openChat = async () => {
    if (!booking || !uid) return;
    try {
      const cid = await getOrCreateConversation(booking.customer_id, uid);
      router.push(`/chat/${cid}`);
    } catch {
      Alert.alert(t("error"));
    }
  };

  const openMaps = async () => {
    if (!booking || booking.lat == null || booking.lng == null) return;
    const dest = `${booking.lat},${booking.lng}`;
    try {
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
    } catch {
      Linking.openURL(`geo:${dest}?q=${dest}`).catch(() => {});
    }
  };

  const Header = (
    <View
      style={{
        ...ROW,
        gap: 12,
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.bg,
      }}
    >
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="arrow-forward" size={24} color={colors.text} />
      </Pressable>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{t("jobTitle")}</Text>
    </View>
  );

  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {Header}
        <Loading />
      </View>
    );

  if (!booking)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {Header}
        <EmptyState icon="briefcase-off-outline" title={t("jobNotFound")} />
      </View>
    );

  const effectiveStatus: BookingStatus = booking.status === "rated" ? "completed" : booking.status;
  const stepIdx = STEPS.indexOf(effectiveStatus);
  const showStepper = stepIdx >= 0;
  const isDone = booking.status === "completed" || booking.status === "rated";
  const gross = booking.price ?? 0;
  const commission = booking.commission ?? Math.round(gross * 0.1 * 100) / 100;
  const net = gross - commission;

  const advance =
    booking.status === "accepted"
      ? { title: t("imOnMyWay"), icon: "truck-fast" as const, next: "on_the_way" as BookingStatus }
      : booking.status === "on_the_way"
        ? { title: t("startWorking"), icon: "hammer-wrench" as const, next: "in_progress" as BookingStatus }
        : booking.status === "in_progress"
          ? { title: t("finishJob"), icon: "flag-checkered" as const, next: "completed" as BookingStatus }
          : null;

  const onAdvance = () => {
    if (!advance) return;
    if (advance.next === "completed") {
      Alert.alert(t("finishConfirmTitle"), t("finishConfirmMsg"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("finishJob"), onPress: () => setStatus("completed") },
      ]);
    } else {
      setStatus(advance.next);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {Header}
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
        {/* cancelled-by-customer banner */}
        {booking.status === "cancelled" ? (
          <View
            style={{
              backgroundColor: colors.dangerTint,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: 6,
              borderWidth: 1.5,
              borderColor: colors.danger,
            }}
          >
            <View style={{ ...ROW, gap: 8 }}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text
                style={[RTL_TEXT, { color: colors.danger, fontSize: 14.5, fontWeight: "800", flexShrink: 1 }]}
              >
                {t("cancelledByCustomerTitle")}
              </Text>
            </View>
            {booking.cancel_reason ? (
              <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 13 }]}>
                {t("cancelReasonLabel")}: {booking.cancel_reason}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* status + stepper */}
        <Card style={{ gap: spacing.lg }}>
          <View style={{ ...ROW, justifyContent: "space-between" }}>
            <View style={{ ...ROW, gap: 8 }}>
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
                  name={(booking.category?.icon as any) ?? "tools"}
                  size={20}
                  color={colors.brand}
                />
              </View>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800" }]}>
                {booking.category ? loc(booking.category, "name") : booking.title}
              </Text>
            </View>
            <Badge label={t(STATUS_KEY[booking.status])} tone={STATUS_TONE[booking.status]} />
          </View>

          {showStepper ? (
            <View style={{ ...ROW, alignItems: "flex-start" }}>
              {STEPS.map((s, i) => {
                const done = i <= stepIdx;
                return (
                  <React.Fragment key={s}>
                    {i > 0 ? (
                      <View
                        style={{
                          flex: 1,
                          height: 3,
                          borderRadius: 2,
                          marginTop: 15,
                          backgroundColor: i <= stepIdx ? colors.brand : colors.chip,
                        }}
                      />
                    ) : null}
                    <View style={{ alignItems: "center", gap: 4, width: 64 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: done ? colors.brand : colors.chip,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={STEP_ICONS[s]}
                          size={16}
                          color={done ? colors.onBrand : colors.faint}
                        />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: done ? colors.text : colors.faint,
                          fontSize: 10.5,
                          fontWeight: done ? "700" : "500",
                          textAlign: "center",
                        }}
                      >
                        {t(STATUS_KEY[s])}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          ) : null}

          {advance ? (
            <Button title={advance.title} icon={advance.icon} loading={busy} onPress={onAdvance} />
          ) : null}

          {booking.status === "pending" ? (
            <View style={{ ...ROW, gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={t("accept")}
                  variant="success"
                  icon="check"
                  loading={busy}
                  onPress={() => setStatus("accepted", { accepted_at: new Date().toISOString() })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={t("reject")}
                  variant="danger"
                  icon="close"
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(t("rejectConfirmTitle"), t("rejectConfirmMsg"), [
                      { text: t("cancel"), style: "cancel" },
                      { text: t("reject"), style: "destructive", onPress: () => setStatus("rejected") },
                    ])
                  }
                />
              </View>
            </View>
          ) : null}
        </Card>

        {/* earnings (after completion) */}
        {isDone && booking.price != null ? (
          <Card style={{ gap: 10 }}>
            <SectionHeader title={t("earningsForJob")} />
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 13.5 }}>{t("grossAmount")}</Text>
              <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: "700" }}>{formatPrice(gross)}</Text>
            </View>
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 13.5 }}>{t("commission")}</Text>
              <Text style={{ color: colors.danger, fontSize: 14.5, fontWeight: "700" }}>
                -{formatPrice(commission)}
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: "800" }}>{t("netAmount")}</Text>
              <Text style={{ color: colors.success, fontSize: 18, fontWeight: "800" }}>{formatPrice(net)}</Text>
            </View>
          </Card>
        ) : null}

        {/* customer */}
        <Card style={{ gap: spacing.md }}>
          <SectionHeader title={t("customerTitle")} />
          <View style={{ ...ROW, justifyContent: "space-between", gap: 10 }}>
            <View style={{ ...ROW, gap: 10, flexShrink: 1 }}>
              <Avatar uri={booking.customer?.avatar_url} name={booking.customer?.full_name} size={46} />
              <View style={{ flexShrink: 1 }}>
                <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800" }]}>
                  {booking.customer?.full_name ?? ""}
                </Text>
                {booking.customer?.phone ? (
                  <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5 }]}>{booking.customer.phone}</Text>
                ) : null}
              </View>
            </View>
            <View style={{ ...ROW, gap: 8 }}>
              {booking.customer?.phone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${booking.customer?.phone}`).catch(() => {})}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.successTint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="call" size={18} color={colors.success} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={openChat}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.brandTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.brand} />
              </Pressable>
            </View>
          </View>
        </Card>

        {/* details */}
        <Card style={{ gap: spacing.md }}>
          <SectionHeader title={t("detailsTitle")} />
          {booking.title ? (
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 14.5, fontWeight: "700" }]}>{booking.title}</Text>
          ) : null}
          {booking.description ? (
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 20 }]}>
              {booking.description}
            </Text>
          ) : null}

          {booking.photos.length ? (
            <View style={{ ...ROW, gap: 8, flexWrap: "wrap" }}>
              {booking.photos.map((p, i) => (
                <Pressable key={i} onPress={() => setViewerUri(p)}>
                  <Image
                    source={{ uri: p }}
                    style={{ width: 74, height: 74, borderRadius: radius.md, backgroundColor: colors.chip }}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </View>
          ) : null}

          {booking.address || booking.city ? (
            <View style={{ ...ROW, gap: 6 }}>
              <Ionicons name="location-outline" size={16} color={colors.brand} />
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 13.5, flexShrink: 1 }]}>
                {[booking.address, booking.city ? loc(booking.city, "name") : ""].filter(Boolean).join("، ")}
              </Text>
            </View>
          ) : null}

          <View style={{ ...ROW, gap: 6 }}>
            <Ionicons name="time-outline" size={16} color={colors.brand} />
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 13.5 }]}>
              {t("scheduleLabel")}: {booking.scheduled_at ? formatDateTime(booking.scheduled_at, lang) : t("asap")}
            </Text>
          </View>

          {booking.price != null ? (
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <View style={{ ...ROW, gap: 6 }}>
                <Ionicons name="cash-outline" size={16} color={colors.brand} />
                <Text style={{ color: colors.text, fontSize: 13.5 }}>{t("agreedPrice")}</Text>
              </View>
              <View style={{ ...ROW, gap: 8 }}>
                <Text style={{ color: colors.brand, fontSize: 17, fontWeight: "800" }}>
                  {formatPrice(booking.price)}
                </Text>
                <Badge label={t("cash")} tone="gold" />
              </View>
            </View>
          ) : null}
          {booking.price != null && !isDone ? (
            <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{t("cashNote")}</Text>
          ) : null}

          {booking.lat != null && booking.lng != null && !isDone ? (
            <Button title={t("navigate")} icon="navigation-variant" variant="outline" onPress={openMaps} />
          ) : null}
        </Card>
      </ScrollView>

      {/* fullscreen photo viewer */}
      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center" }}>
          <Pressable
            onPress={() => setViewerUri(null)}
            style={{
              position: "absolute",
              top: insets.top + 12,
              left: 16,
              zIndex: 2,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
              ...shadows.float,
            }}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          {viewerUri ? (
            <Image source={{ uri: viewerUri }} style={{ width: "100%", height: "80%" }} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
