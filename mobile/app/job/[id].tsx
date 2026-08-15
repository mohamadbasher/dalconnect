// Pro's live view of a job — customer contact (revealed once accepted), the
// agreed quote range, navigation, status advance and the final agreed price.
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextStyle,
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
import { channelTopic } from "../../lib/realtime";
import { getOrCreateConversation } from "../../lib/chat";
import { callPhone, fetchContactPhone, openWhatsApp } from "../../lib/contact";
import { formatDateTime, STATUS_KEY, STATUS_TONE } from "../../lib/format";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
  SectionHeader,
  SheetHandle,
} from "../../components/ui";
import { useToast } from "../../components/Toast";
import type { Booking, BookingStatus, BookingUrgency } from "../../lib/types";
import { PROFILE_FIELDS } from "../../lib/queries";

const STEPS: BookingStatus[] = ["accepted", "on_the_way", "in_progress", "completed"];
const STEP_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  accepted: "check",
  on_the_way: "truck-fast",
  in_progress: "hammer-wrench",
  completed: "flag-checkered",
};
/** the phone number is handed over only from acceptance onwards */
const CONTACT_STATUSES: BookingStatus[] = ["accepted", "on_the_way", "in_progress", "completed", "rated"];

/** Prices and phone numbers are Latin digits — pin them LTR inside the RTL layout. */
const LTR: TextStyle = { writingDirection: "ltr" };

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = session?.user?.id ?? null;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // contact reveal
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // finish-job sheet
  const [finishOpen, setFinishOpen] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const [finalPriceError, setFinalPriceError] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("bookings")
        .select(`*, category:categories(*), customer:profiles!bookings_customer_id_fkey(${PROFILE_FIELDS}), city:cities(*)`)
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
      .channel(channelTopic(`job-${id}`))
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

  // the RPC hands back the OTHER party's number, and only once it's unlocked
  const contactUnlocked = !!booking && CONTACT_STATUSES.includes(booking.status);
  useEffect(() => {
    let alive = true;
    if (!id || !contactUnlocked) {
      setPhone(null);
      return;
    }
    setPhoneLoading(true);
    fetchContactPhone(id)
      .then((p) => {
        if (alive) setPhone(p);
      })
      .finally(() => {
        if (alive) setPhoneLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, contactUnlocked]);

  const setStatus = async (next: BookingStatus, extra?: Record<string, unknown>) => {
    if (!booking || busy) return false;
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
      toast.error(t("error"));
      return false;
    }
    if (!data?.length) {
      // status changed elsewhere (e.g. customer cancelled) — resync and say so
      await load();
      setBusy(false);
      toast.info(t("statusChangedElsewhere"));
      return false;
    }
    setBooking((prev) => (prev ? { ...prev, status: next, ...(extra as Partial<Booking>) } : prev));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast.success(t(next === "completed" ? "jobCompletedToast" : "statusUpdated"));
    // refetch so trigger-computed fields (commission, completed_at) come through
    await load();
    setBusy(false);
    return true;
  };

  const openChat = async () => {
    if (!booking || !uid) return;
    try {
      const cid = await getOrCreateConversation(booking.customer_id, uid);
      router.push(`/chat/${cid}`);
    } catch {
      toast.error(t("error"));
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
      {/* RTL: "forward" points left-to-right, so back is the right-pointing arrow */}
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="arrow-forward" size={24} color={colors.text} />
      </Pressable>
      <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
        {t("jobTitle")}
      </Text>
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

  // what the pro actually earns from: the final agreed price, with sensible fallbacks
  const gross = booking.final_price ?? booking.price ?? booking.price_min ?? 0;
  const commission = booking.commission ?? Math.round(gross * 0.1 * 100) / 100;
  const net = gross - commission;

  const rangeMin = booking.price_min;
  const rangeMax = booking.price_max;
  const rangeLabel =
    rangeMin != null && rangeMax != null && rangeMax !== rangeMin
      ? `${formatPrice(rangeMin)} – ${formatPrice(rangeMax)}`
      : rangeMin != null
        ? formatPrice(rangeMin)
        : rangeMax != null
          ? formatPrice(rangeMax)
          : booking.price != null
            ? formatPrice(booking.price)
            : null;

  // one accent for urgency — a tinted pill, no extra borders shouting alongside it
  const renderUrgency = (urgency: BookingUrgency) => {
    const urgent = urgency === "same_day";
    return (
      <View
        style={{
          ...ROW,
          gap: 5,
          // RTL: the pill hugs the right (start) edge under the title
          alignSelf: "flex-end",
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
          style={{ color: urgent ? colors.danger : colors.muted, fontSize: 11.5, fontWeight: "700" }}
        >
          {t(urgent ? "quoteUrgent" : "quoteScheduled")}
        </Text>
      </View>
    );
  };

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
      // finishing writes the ledger — we need the price that was actually agreed
      setFinalPrice(booking.price_min != null ? String(booking.price_min) : booking.price != null ? String(booking.price) : "");
      setFinalPriceError(undefined);
      setFinishOpen(true);
    } else {
      setStatus(advance.next);
    }
  };

  const confirmFinish = async () => {
    const n = parseFloat(finalPrice.replace(",", "."));
    if (!finalPrice.trim() || !Number.isFinite(n) || n <= 0) {
      setFinalPriceError(t("proFinalPriceInvalid"));
      return;
    }
    const ok = await setStatus("completed", { final_price: n });
    if (ok) setFinishOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {Header}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
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
              padding: spacing.md,
              gap: 4,
            }}
          >
            <View style={{ ...ROW, gap: 8 }}>
              <Ionicons name="alert-circle" size={19} color={colors.danger} />
              <Text style={[RTL_TEXT, { flex: 1, color: colors.danger, fontSize: 14, fontWeight: "800" }]}>
                {t("cancelledByCustomerTitle")}
              </Text>
            </View>
            {booking.cancel_reason ? (
              <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12.5, lineHeight: 19 }]}>
                {t("proCancelReasonLabel")}: {booking.cancel_reason}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* ---------- status + agreed range + stepper + the one action ---------- */}
        <Card style={{ gap: spacing.lg }}>
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
                  name={(booking.category?.icon as any) ?? "tools"}
                  size={21}
                  color={colors.brand}
                />
              </View>
              <View style={{ flexShrink: 1, gap: 5 }}>
                <Text
                  numberOfLines={1}
                  style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800" }]}
                >
                  {booking.category ? loc(booking.category, "name") : booking.title}
                </Text>
                {renderUrgency(booking.urgency)}
              </View>
            </View>
            <Badge label={t(STATUS_KEY[booking.status])} tone={STATUS_TONE[booking.status]} />
          </View>

          {/* the range the customer accepted */}
          {rangeLabel ? (
            <View
              style={{
                backgroundColor: colors.brandTint,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 4,
              }}
            >
              <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                <Text style={[RTL_TEXT, { color: colors.brand, fontSize: 13, fontWeight: "700", flexShrink: 1 }]}>
                  {t("quoteAgreedRange")}
                </Text>
                <Text style={[LTR, { color: colors.brand, fontSize: 18, fontWeight: "800" }]}>{rangeLabel}</Text>
              </View>
              {!isDone ? (
                <Text style={[RTL_TEXT, { color: colors.brand, fontSize: 12, opacity: 0.85 }]}>
                  {t("quoteFinalOnPhone")}
                </Text>
              ) : null}
            </View>
          ) : null}

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
                          borderRadius: radius.full,
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
                          borderRadius: radius.full,
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

          {/* legacy direct bookings (no longer created) may still arrive as `pending` */}
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

        {/* ---------- the customer + how to reach them ---------- */}
        <Card style={{ gap: spacing.md }}>
          <SectionHeader title={t("customerTitle")} />
          <View style={{ ...ROW, gap: spacing.md }}>
            <Avatar uri={booking.customer?.avatar_url} name={booking.customer?.full_name} size={46} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800" }]}>
                {booking.customer?.full_name ?? ""}
              </Text>
              {contactUnlocked && phone ? (
                <Text style={[LTR, { color: colors.muted, fontSize: 13.5, textAlign: "right" }]}>{phone}</Text>
              ) : (
                <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12.5, lineHeight: 18 }]}>
                  {contactUnlocked
                    ? phoneLoading
                      ? t("loading")
                      : t("proContactUnavailable")
                    : t("proContactLocked")}
                </Text>
              )}
            </View>
          </View>

          {contactUnlocked && phone ? (
            <View style={{ ...ROW, gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={t("call")}
                  variant="success"
                  icon="phone"
                  onPress={() => {
                    callPhone(phone).then((ok) => {
                      if (!ok) toast.error(t("error"));
                    });
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={t("proWhatsApp")}
                  variant="outline"
                  icon="whatsapp"
                  onPress={() => {
                    openWhatsApp(phone).then((ok) => {
                      if (!ok) toast.error(t("error"));
                    });
                  }}
                />
              </View>
            </View>
          ) : null}

          {/* in-app chat stays available as the quieter option */}
          <Button title={t("proChatInApp")} variant="ghost" small icon="chat-outline" onPress={openChat} />
        </Card>

        {/* ---------- details ---------- */}
        <Card style={{ gap: spacing.md }}>
          <SectionHeader title={t("proDetailsTitle")} />
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
                <Pressable
                  key={i}
                  onPress={() => setViewerUri(p)}
                  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}
                >
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
            <View style={{ ...ROW, gap: 8, alignItems: "flex-start" }}>
              <Ionicons name="location-outline" size={16} color={colors.brand} style={{ marginTop: 2 }} />
              <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 13.5, lineHeight: 20 }]}>
                {[booking.address, booking.city ? loc(booking.city, "name") : ""].filter(Boolean).join("، ")}
              </Text>
            </View>
          ) : null}

          <View style={{ ...ROW, gap: 8 }}>
            <Ionicons name="time-outline" size={16} color={colors.brand} />
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5 }]}>{t("proScheduleLabel")}</Text>
            <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: "600" }]}>
              {booking.scheduled_at ? formatDateTime(booking.scheduled_at, lang) : t("proAsap")}
            </Text>
          </View>

          {!isDone ? (
            <View style={{ ...ROW, gap: 8 }}>
              <Badge label={t("cash")} tone="gold" />
              <Text style={[RTL_TEXT, { flex: 1, color: colors.faint, fontSize: 12, lineHeight: 18 }]}>
                {t("proCashNote")}
              </Text>
            </View>
          ) : null}

          {booking.lat != null && booking.lng != null && !isDone ? (
            <Button title={t("navigate")} icon="navigation-variant" variant="outline" onPress={openMaps} />
          ) : null}
        </Card>

        {/* ---------- earnings (after completion) — from the real final price ---------- */}
        {isDone && gross > 0 ? (
          <Card style={{ gap: 10 }}>
            <SectionHeader title={t("earningsForJob")} />
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 13.5 }}>{t("proFinalPriceTitle")}</Text>
              <Text style={[LTR, { color: colors.text, fontSize: 14.5, fontWeight: "700" }]}>
                {formatPrice(gross)}
              </Text>
            </View>
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 13.5 }}>{t("commission")}</Text>
              <Text style={[LTR, { color: colors.danger, fontSize: 14.5, fontWeight: "700" }]}>
                {`−${formatPrice(commission)}`}
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.hairline }} />
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: "800" }}>{t("netAmount")}</Text>
              <Text style={[LTR, { color: colors.success, fontSize: 20, fontWeight: "800" }]}>
                {formatPrice(net)}
              </Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {/* ---------- finish job — the final agreed price drives the ledger ---------- */}
      <Modal visible={finishOpen} transparent animationType="slide" onRequestClose={() => setFinishOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setFinishOpen(false)} />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.xl,
              gap: spacing.lg,
            }}
          >
            <SheetHandle />

            <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
              <Text style={[RTL_TEXT, { flexShrink: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
                {t("proFinalPriceTitle")}
              </Text>
              <Pressable onPress={() => setFinishOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, lineHeight: 19 }]}>
              {t("proFinalPriceHint")}
            </Text>

            <Input
              label={t("proFinalPriceLabel")}
              placeholder={t("quoteMinPlaceholder")}
              keyboardType="numeric"
              value={finalPrice}
              onChangeText={(v) => {
                setFinalPrice(v);
                setFinalPriceError(undefined);
              }}
              error={finalPriceError}
              style={LTR}
            />

            {rangeLabel ? (
              <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5 }}>{t("quoteAgreedRange")}</Text>
                <Text style={[LTR, { color: colors.text, fontSize: 13, fontWeight: "700" }]}>{rangeLabel}</Text>
              </View>
            ) : null}

            <Button
              title={t("proFinalPriceConfirm")}
              icon="flag-checkered"
              loading={busy}
              onPress={confirmFinish}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* fullscreen photo viewer */}
      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center" }}>
          <Pressable
            onPress={() => setViewerUri(null)}
            style={{
              position: "absolute",
              top: insets.top + 12,
              // RTL: the close button sits on the start (right) edge
              right: 16,
              zIndex: 2,
              width: 40,
              height: 40,
              borderRadius: radius.full,
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
