// Create request — single-scroll form. Every request is an OPEN request: the
// customer picks a service and an urgency, and every nearby professional in
// that trade is invited to quote. Customers never pick the professional.
//
// Presentation: clearly separated blocks (SectionHeader + generous rhythm),
// urgency as the centrepiece, a quiet completion meter docked above the CTA.
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import MapView, { Marker } from "react-native-maps";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, radius, spacing, formatPrice } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchCategories, fetchCities } from "../lib/refdata";
import { uploadImage } from "../lib/upload";
import { getCurrentPosition } from "../lib/location";
import { TIME_SLOTS } from "../lib/hours";
import { ROW, RTL_TEXT } from "../lib/rtl";
import {
  Badge,
  Button,
  Chip,
  InlineNote,
  Input,
  Loading,
  SearchBar,
  SectionHeader,
  SheetHandle,
  pressCard,
} from "../components/ui";
import { CalendarModal } from "../components/CalendarModal";
import { useToast } from "../components/Toast";
import type { BookingUrgency, Category, City } from "../lib/types";

const MAX_PHOTOS = 4;

/** merge a calendar day with an "HH:mm" slot into one Date */
function composeAt(day: Date, slot: string): Date {
  const [h, m] = slot.split(":");
  const out = new Date(day);
  out.setHours(Number(h), Number(m), 0, 0);
  return out;
}

type Fees = Record<BookingUrgency, number>;

export default function CreateBooking() {
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session, profile } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // `description` arrives pre-filled from the quick-request flow, where the
  // customer has already typed the problem out once.
  const params = useLocalSearchParams<{ categoryId?: string; description?: string }>();

  // reference data
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  /** platform request fee per urgency — the owner sets these later, 0 means "not priced yet" */
  const [fees, setFees] = useState<Fees>({ same_day: 0, scheduled: 0 });

  // form state
  const [categoryId, setCategoryId] = useState<number | null>(
    params.categoryId ? Number(params.categoryId) || null : null
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(params.description ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  const [cityId, setCityId] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [urgency, setUrgency] = useState<BookingUrgency | null>(null);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);

  // ui state
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cityModal, setCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ n: number; total: number } | null>(null);
  const [errors, setErrors] = useState<{
    category?: string;
    description?: string;
    urgency?: string;
    schedule?: string;
  }>({});

  useEffect(() => {
    (async () => {
      try {
        const [cats, cts] = await Promise.all([fetchCategories(), fetchCities()]);
        setCategories(cats);
        setCities(cts);
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  // request fees come from the price list; a missing/failed read just means "no price shown"
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["fee_same_day", "fee_scheduled"]);
      if (error || !data) return;
      const next: Fees = { same_day: 0, scheduled: 0 };
      for (const row of data as { key: string; value: unknown }[]) {
        const n = Number(row.value);
        if (Number.isNaN(n)) continue;
        if (row.key === "fee_same_day") next.same_day = n;
        if (row.key === "fee_scheduled") next.scheduled = n;
      }
      setFees(next);
    })();
  }, []);

  // prefill the city from the customer's profile while none is chosen
  useEffect(() => {
    if (cityId === null && profile?.city_id != null && cities.some((c) => c.id === profile.city_id)) {
      setCityId(profile.city_id);
    }
  }, [cityId, profile?.city_id, cities]);

  /** scheduled means "tomorrow or later" — today belongs to the same-day option */
  const tomorrowStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const dateLabel = (d: Date) =>
    d.toLocaleDateString(lang === "ar" ? "ar" : "he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  // ---- completion meter (guidance, not a gate) ----
  const checks = useMemo(
    () => [
      categoryId !== null,
      description.trim().length >= 10,
      urgency !== null,
      cityId !== null || address.trim().length > 0,
      photos.length > 0,
    ],
    [categoryId, description, urgency, cityId, address, photos.length]
  );
  const doneCount = checks.filter(Boolean).length;
  const pct = Math.round((doneCount / checks.length) * 100);
  const complete = doneCount === checks.length;

  const pickPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (res.canceled) return;
    const uris = res.assets.map((a) => a.uri);
    setPhotos((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
  };

  const useMyLocation = async () => {
    setLocating(true);
    const pos = await getCurrentPosition();
    setLocating(false);
    if (!pos) {
      toast.error(t("locationFailed"));
      return;
    }
    setCoords(pos);
    Haptics.selectionAsync().catch(() => {});
  };

  const chooseUrgency = (u: BookingUrgency) => {
    setUrgency(u);
    setErrors((e) => ({ ...e, urgency: undefined, schedule: undefined }));
    if (u === "same_day") {
      // a same-day job has no preferred slot — it is "now"
      setPickedDate(null);
      setPickedSlot(null);
    } else if (!pickedDate) {
      setCalendarOpen(true);
    }
    Haptics.selectionAsync().catch(() => {});
  };

  const selectedCity = cities.find((c) => c.id === cityId) ?? null;
  const filteredCities = useMemo(() => {
    const q = citySearch.trim();
    if (!q) return cities;
    return cities.filter((c) => c.name_ar.includes(q) || c.name_he.includes(q));
  }, [cities, citySearch]);

  const submit = async () => {
    const uid = session?.user.id;
    if (!uid || submitting) return;
    const errs: typeof errors = {};
    if (!categoryId) errs.category = t("categoryRequired");
    if (description.trim().length < 10) errs.description = t("descriptionTooShort");
    if (urgency === null) errs.urgency = t("urgencyRequired");
    if (urgency === "scheduled") {
      // the preferred slot is optional, but half a slot is not a slot
      if ((pickedDate === null) !== (pickedSlot === null)) errs.schedule = t("pickTimeError");
      else if (pickedDate !== null && pickedSlot !== null) {
        if (composeAt(pickedDate, pickedSlot).getTime() <= Date.now()) errs.schedule = t("pastTimeError");
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress({ n: i + 1, total: photos.length });
        photoUrls.push(
          await uploadImage({
            bucket: "booking-photos",
            userId: uid,
            localUri: photos[i],
            fileName: `${Date.now()}_${i}.jpg`,
          })
        );
      }
      setUploadProgress(null);
      let scheduledAt: string | null = null;
      if (urgency === "scheduled" && pickedDate !== null && pickedSlot !== null) {
        scheduledAt = composeAt(pickedDate, pickedSlot).toISOString();
      }
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          type: "open",
          status: "open",
          customer_id: uid,
          professional_id: null,
          category_id: categoryId,
          title: title.trim(),
          description: description.trim(),
          photos: photoUrls,
          city_id: cityId,
          address: address.trim(),
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          scheduled_at: scheduledAt,
          urgency,
          // service_fee is stamped by the set_request_fee trigger from the price list
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(t("requestPostedToast"));
      router.replace(`/booking/${(data as { id: string }).id}` as never);
    } catch {
      toast.error(t("bookingFailedToast"));
    } finally {
      setUploadProgress(null);
      setSubmitting(false);
    }
  };

  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (categories === null) return <Loading />;

  /** the two urgency choices — the visual centrepiece of the form */
  const urgencyCard = (
    value: BookingUrgency,
    icon: keyof typeof MaterialCommunityIcons.glyphMap,
    titleKey: string,
    subKey: string
  ) => {
    const active = urgency === value;
    const fee = fees[value];
    const costsMore = value === "same_day" && fees.same_day > fees.scheduled;
    return (
      <Pressable
        onPress={() => chooseUrgency(value)}
        style={({ pressed }) => [
          {
            backgroundColor: active ? colors.brandTint : colors.card,
            borderRadius: radius.lg,
            // transparent when idle keeps the box the same size without an outline
            borderWidth: 1.5,
            borderColor: active ? colors.brand : "transparent",
            padding: spacing.lg,
            gap: spacing.md,
            ...shadows.card,
          },
          pressed ? pressCard : null,
        ]}
      >
        <View style={{ ...ROW, gap: spacing.md }}>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: radius.tile,
              backgroundColor: active ? colors.brand : colors.chip,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name={icon} size={28} color={active ? colors.onBrand : colors.brand} />
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ ...ROW, gap: spacing.sm }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 16.5, fontWeight: "800" }]}>
                {t(titleKey)}
              </Text>
              {costsMore ? <Badge label={t("urgencyCostsMore")} tone="gold" /> : null}
            </View>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, lineHeight: 18 }]}>{t(subKey)}</Text>
          </View>

          <Ionicons
            name={active ? "radio-button-on" : "ellipse-outline"}
            size={22}
            color={active ? colors.brand : colors.faint}
          />
        </View>

        {/* the owner hasn't priced requests yet — a "₪0" would read as a bug */}
        {fee > 0 ? (
          <View style={{ ...ROW, gap: spacing.sm }}>
            <Text style={[RTL_TEXT, { color: colors.brand, fontSize: 15.5, fontWeight: "800" }]}>
              {formatPrice(fee)}
            </Text>
            <Text numberOfLines={1} style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 11.5 }]}>
              {t("urgencyFeeNote")}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  /** shared look for the two "tap to choose" rows (date, city) */
  const pickerRow = (label: string, placeholder: boolean, onPress: () => void, icon?: "calendar-outline") => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          ...ROW,
          justifyContent: "space-between",
          backgroundColor: colors.card,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 13,
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <View style={{ ...ROW, gap: spacing.sm, flex: 1 }}>
        {icon ? <Ionicons name={icon} size={17} color={colors.brand} /> : null}
        <Text
          numberOfLines={1}
          style={[RTL_TEXT, { flex: 1, color: placeholder ? colors.faint : colors.text, fontSize: 15 }]}
        >
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={17} color={colors.faint} />
    </Pressable>
  );

  const fieldError = (msg?: string) =>
    msg ? <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{msg}</Text> : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header — RTL back arrow points right and sits on the right */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.bg,
          ...ROW,
          gap: spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
          {t("newBooking")}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xl,
            gap: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* how this works */}
          <InlineNote tone="info" icon="information-outline" text={t("openRequestInfo")} />

          {/* 1 — service */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("chooseCategory")} />
            {/* `inverted` makes the strip start from the right */}
            <FlatList
              data={categories}
              horizontal
              inverted
              keyExtractor={(c) => String(c.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
              style={{ flexGrow: 0 }}
              renderItem={({ item }) => (
                <Chip
                  label={loc(item, "name")}
                  icon={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  active={categoryId === item.id}
                  onPress={() => {
                    setCategoryId(item.id);
                    setErrors((e) => ({ ...e, category: undefined }));
                  }}
                />
              )}
            />
            {fieldError(errors.category)}
          </View>

          {/* 2 — what needs doing */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("detailsTitle")} />
            <Input
              label={`${t("bookingTitleLabel")} (${t("optional")})`}
              placeholder={t("bookingTitlePlaceholder")}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
            <Input
              label={t("descriptionLabel")}
              placeholder={t("descriptionPlaceholder")}
              value={description}
              onChangeText={(v) => {
                setDescription(v);
                if (v.trim().length >= 10) setErrors((e) => ({ ...e, description: undefined }));
              }}
              error={errors.description}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: "top" }}
            />
          </View>

          {/* 3 — urgency: the pricing decision, so it owns the block */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("urgencyTitle")} />
            {urgencyCard("same_day", "flash", "urgencySameDay", "urgencySameDaySub")}
            {urgencyCard("scheduled", "calendar-clock", "urgencyScheduled", "urgencyScheduledSub")}
            {fieldError(errors.urgency)}

            {urgency === "scheduled" ? (
              <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
                <View style={{ ...ROW, gap: spacing.sm }}>
                  <Text style={[RTL_TEXT, { color: colors.text, fontSize: 13.5, fontWeight: "700" }]}>
                    {t("scheduledFor")}
                  </Text>
                  <Text style={[RTL_TEXT, { flex: 1, color: colors.faint, fontSize: 11.5 }]}>
                    {t("urgencyPickTimeOptional")}
                  </Text>
                </View>

                {/* date — opens the month grid (tomorrow onwards) */}
                {pickerRow(
                  pickedDate ? dateLabel(pickedDate) : t("chooseDate"),
                  pickedDate === null,
                  () => setCalendarOpen(true),
                  "calendar-outline"
                )}

                {/* time — half-hour slots, RTL strip starting from the right */}
                <View style={{ gap: spacing.sm }}>
                  <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, fontWeight: "700" }]}>
                    {t("chooseHour")}
                  </Text>
                  <FlatList
                    data={TIME_SLOTS}
                    horizontal
                    inverted
                    keyExtractor={(s) => s}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing.sm }}
                    style={{ flexGrow: 0 }}
                    renderItem={({ item }) => (
                      <Chip
                        label={item}
                        active={pickedSlot === item}
                        onPress={() => {
                          setPickedSlot(item);
                          setErrors((e) => ({ ...e, schedule: undefined }));
                        }}
                      />
                    )}
                  />
                </View>

                {pickedDate && pickedSlot ? (
                  <View style={{ ...ROW, gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                    <Text style={[RTL_TEXT, { flex: 1, color: colors.success, fontSize: 12.5 }]}>
                      {t("scheduleSummary", { date: dateLabel(pickedDate), time: pickedSlot })}
                    </Text>
                  </View>
                ) : null}
                {fieldError(errors.schedule)}
              </View>
            ) : null}
          </View>

          {/* 4 — photos */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("photosLabel", { n: MAX_PHOTOS })} />
            {/* row-reverse: the "add" tile sits first, on the right */}
            <View style={{ ...ROW, gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              {photos.length < MAX_PHOTOS ? (
                <Pressable
                  onPress={pickPhotos}
                  style={({ pressed }) => [
                    {
                      width: 72,
                      height: 72,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderStyle: "dashed",
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    },
                    pressed ? pressCard : null,
                  ]}
                >
                  <Ionicons name="camera-outline" size={22} color={colors.brand} />
                  <Text style={{ color: colors.muted, fontSize: 9.5, fontWeight: "600" }}>{t("addPhoto")}</Text>
                </Pressable>
              ) : null}
              {photos.map((uri) => (
                <View key={uri} style={{ width: 72, height: 72 }}>
                  <Image
                    source={{ uri }}
                    style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.chip }}
                    contentFit="cover"
                  />
                  {/* mirrored corner: RTL content starts on the right, so the
                      remove affordance lives on the left */}
                  <Pressable
                    onPress={() => setPhotos((prev) => prev.filter((p) => p !== uri))}
                    hitSlop={8}
                    style={{
                      position: "absolute",
                      top: -6,
                      left: -6,
                      width: 20,
                      height: 20,
                      borderRadius: radius.full,
                      backgroundColor: colors.danger,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close" size={13} color={colors.onBrand} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          {/* 5 — where */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("locationLabel")} />
            {pickerRow(
              selectedCity ? loc(selectedCity, "name") : t("chooseCity"),
              selectedCity === null,
              () => setCityModal(true)
            )}
            <Input
              label={t("addressLabel")}
              placeholder={t("addressPlaceholder")}
              value={address}
              onChangeText={setAddress}
            />
            <View style={{ ...ROW }}>
              <Chip
                label={locating ? t("loading") : t("useMyLocation")}
                icon="crosshairs-gps"
                active={coords !== null}
                onPress={useMyLocation}
              />
            </View>
            {coords ? (
              <View style={{ gap: 6 }}>
                <View style={{ borderRadius: radius.lg, overflow: "hidden", ...shadows.card }}>
                  <MapView
                    key={`${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`}
                    style={{ height: 120 }}
                    initialRegion={{
                      latitude: coords.lat,
                      longitude: coords.lng,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                  >
                    <Marker
                      coordinate={{ latitude: coords.lat, longitude: coords.lng }}
                      draggable
                      onDragEnd={(e) =>
                        setCoords({
                          lat: e.nativeEvent.coordinate.latitude,
                          lng: e.nativeEvent.coordinate.longitude,
                        })
                      }
                    />
                  </MapView>
                </View>
                <Text style={[RTL_TEXT, { color: colors.success, fontSize: 12 }]}>{t("locationSet")}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* sticky submit — the completion meter rides quietly above it */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
            gap: spacing.md,
            ...shadows.floatUp,
          }}
        >
          <View style={{ gap: 6 }}>
            <View style={{ ...ROW, justifyContent: "space-between", gap: spacing.sm }}>
              <Text numberOfLines={1} style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 11.5 }]}>
                {complete ? t("meterReady") : t("meterRemaining", { n: checks.length - doneCount })}
              </Text>
              <Text style={{ color: complete ? colors.success : colors.brand, fontSize: 11.5, fontWeight: "800" }}>
                {pct}%
              </Text>
            </View>
            {/* row-reverse track so the bar fills from the right */}
            <View
              style={{
                ...ROW,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: colors.chip,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: radius.full,
                  backgroundColor: complete ? colors.success : colors.brand,
                }}
              />
            </View>
          </View>

          <Button
            title={
              uploadProgress
                ? t("uploadingPhotos", { n: uploadProgress.n, total: uploadProgress.total })
                : t("submitBooking")
            }
            onPress={submit}
            loading={submitting && uploadProgress === null}
            disabled={submitting}
            icon={uploadProgress ? "cloud-upload-outline" : "send"}
          />
        </View>
      </KeyboardAvoidingView>

      {/* date picker — scheduled requests start tomorrow */}
      <CalendarModal
        visible={calendarOpen}
        value={pickedDate}
        title={t("chooseDate")}
        minDate={tomorrowStart}
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setPickedDate(d);
          setCalendarOpen(false);
          setErrors((e) => ({ ...e, schedule: undefined }));
        }}
      />

      {/* city picker bottom sheet */}
      <Modal visible={cityModal} transparent animationType="slide" onRequestClose={() => setCityModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setCityModal(false)} />
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              maxHeight: "75%",
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              gap: spacing.md,
            }}
          >
            <SheetHandle />
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>
                {t("chooseCity")}
              </Text>
              <Pressable onPress={() => setCityModal(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <SearchBar value={citySearch} onChangeText={setCitySearch} placeholder={t("searchCity")} />
            <FlatList
              data={filteredCities}
              keyExtractor={(c) => String(c.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ color: colors.muted, fontSize: 13.5, paddingVertical: 24, textAlign: "center" }}>
                  {t("noResults")}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCityId(item.id);
                    setCityModal(false);
                    setCitySearch("");
                  }}
                  style={{
                    ...ROW,
                    justifyContent: "space-between",
                    paddingVertical: 13,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.hairline,
                  }}
                >
                  <View style={{ ...ROW, gap: spacing.sm }}>
                    <Text
                      style={[
                        RTL_TEXT,
                        { color: colors.text, fontSize: 15, fontWeight: cityId === item.id ? "800" : "500" },
                      ]}
                    >
                      {loc(item, "name")}
                    </Text>
                    {item.area ? (
                      <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{item.area}</Text>
                    ) : null}
                  </View>
                  {cityId === item.id ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
