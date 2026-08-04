// Create booking — single-scroll form. `proId` present ⇒ direct booking
// (status 'pending'), otherwise an open request collecting offers.
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
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchCategories, fetchCities } from "../lib/refdata";
import { uploadImage } from "../lib/upload";
import { getCurrentPosition } from "../lib/location";
import { TIME_SLOTS } from "../lib/hours";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Avatar, Button, Card, Chip, Input, Loading, SearchBar, SectionHeader, StarRating } from "../components/ui";
import { CalendarModal } from "../components/CalendarModal";
import { useToast } from "../components/Toast";
import type { Category, City, Professional, Profile } from "../lib/types";

const MAX_PHOTOS = 4;

/** merge a calendar day with an "HH:mm" slot into one Date */
function composeAt(day: Date, slot: string): Date {
  const [h, m] = slot.split(":");
  const out = new Date(day);
  out.setHours(Number(h), Number(m), 0, 0);
  return out;
}

type ProWithProfile = Professional & { profile?: Profile };

export default function CreateBooking() {
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session, profile } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ categoryId?: string; proId?: string }>();
  const proId = params.proId || null;

  // reference / pro data
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [pro, setPro] = useState<ProWithProfile | null>(null);
  const [proCatIds, setProCatIds] = useState<number[] | null>(null);

  // form state
  const [categoryId, setCategoryId] = useState<number | null>(
    params.categoryId ? Number(params.categoryId) : null
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [cityId, setCityId] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"asap" | "pick">("asap");
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);

  // ui state
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cityModal, setCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ n: number; total: number } | null>(null);
  const [errors, setErrors] = useState<{ category?: string; description?: string; schedule?: string }>({});

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

  useEffect(() => {
    if (!proId) return;
    (async () => {
      const { data } = await supabase
        .from("professionals")
        .select("*, profile:profiles!professionals_id_fkey(*)")
        .eq("id", proId)
        .maybeSingle();
      setPro((data as ProWithProfile | null) ?? null);
      const { data: pcs } = await supabase
        .from("professional_categories")
        .select("category_id")
        .eq("professional_id", proId);
      setProCatIds(((pcs as { category_id: number }[] | null) ?? []).map((r) => r.category_id));
    })();
  }, [proId]);

  const shownCategories = useMemo(() => {
    if (!categories) return [];
    if (proId && proCatIds && proCatIds.length > 0) return categories.filter((c) => proCatIds.includes(c.id));
    return categories;
  }, [categories, proId, proCatIds]);

  // if the pro offers a single category, preselect it
  useEffect(() => {
    if (proId && shownCategories.length === 1 && categoryId === null) setCategoryId(shownCategories[0].id);
  }, [proId, shownCategories, categoryId]);

  // direct booking: drop a preselected category the pro doesn't offer
  useEffect(() => {
    if (proId && proCatIds && proCatIds.length > 0 && categoryId !== null && !proCatIds.includes(categoryId)) {
      setCategoryId(null);
    }
  }, [proId, proCatIds, categoryId]);

  // prefill the city from the customer's profile while none is chosen
  useEffect(() => {
    if (cityId === null && profile?.city_id != null && cities.some((c) => c.id === profile.city_id)) {
      setCityId(profile.city_id);
    }
  }, [cityId, profile?.city_id, cities]);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString();

  const dateLabel = (d: Date) => {
    const formatted = d.toLocaleDateString(lang === "ar" ? "ar" : "he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return isToday(d) ? `${t("today")} · ${formatted}` : formatted;
  };

  // ---- completion meter (guidance, not a gate) ----
  const checks = useMemo(
    () => [
      { key: "category", label: t("meterCategory"), done: categoryId !== null },
      { key: "description", label: t("meterDescription"), done: description.trim().length >= 10 },
      { key: "place", label: t("meterPlace"), done: cityId !== null || address.trim().length > 0 },
      { key: "photos", label: t("meterPhotos"), done: photos.length > 0 },
    ],
    [t, categoryId, description, cityId, address, photos.length]
  );
  const doneCount = checks.filter((c) => c.done).length;
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
    if (scheduleMode === "pick" && (pickedDate === null || pickedSlot === null)) errs.schedule = t("pickTimeError");
    if (scheduleMode === "pick" && pickedDate !== null && pickedSlot !== null) {
      if (composeAt(pickedDate, pickedSlot).getTime() <= Date.now()) errs.schedule = t("pastTimeError");
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
      if (scheduleMode === "pick" && pickedDate !== null && pickedSlot !== null) {
        scheduledAt = composeAt(pickedDate, pickedSlot).toISOString();
      }
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          type: proId ? "direct" : "open",
          status: proId ? "pending" : "open",
          customer_id: uid,
          professional_id: proId,
          category_id: categoryId,
          title: title.trim(),
          description: description.trim(),
          photos: photoUrls,
          city_id: cityId,
          address: address.trim(),
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          scheduled_at: scheduledAt,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(proId ? t("bookingSentToast") : t("requestPostedToast"));
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

  const now = new Date();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header */}
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
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{t("newBooking")}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* who you're booking / open info banner */}
          {proId ? (
            pro ? (
              <Card style={{ gap: 4 }}>
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12, fontWeight: "600" }]}>
                  {t("bookingWith")}
                </Text>
                <View style={{ ...ROW, gap: 12 }}>
                  <Avatar
                    uri={pro.profile?.avatar_url}
                    name={pro.business_name || pro.profile?.full_name}
                    size={46}
                  />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
                      {pro.business_name || pro.profile?.full_name || ""}
                    </Text>
                    <View style={{ ...ROW, gap: 6 }}>
                      <StarRating rating={pro.rating_avg} size={13} />
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {pro.rating_avg.toFixed(1)} ({pro.rating_count})
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ) : null
          ) : (
            <View
              style={{
                ...ROW,
                gap: 10,
                backgroundColor: colors.infoTint,
                borderRadius: radius.md,
                padding: spacing.md,
                alignItems: "flex-start",
              }}
            >
              <Ionicons name="information-circle" size={20} color={colors.info} />
              <Text style={[RTL_TEXT, { color: colors.info, fontSize: 13, flex: 1, lineHeight: 19 }]}>
                {t("openRequestInfo")}
              </Text>
            </View>
          )}

          {/* category */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("chooseCategory")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[...shownCategories].reverse().map((c) => (
                <Chip
                  key={c.id}
                  label={loc(c, "name")}
                  icon={c.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  active={categoryId === c.id}
                  onPress={() => {
                    setCategoryId(c.id);
                    setErrors((e) => ({ ...e, category: undefined }));
                  }}
                />
              ))}
            </ScrollView>
            {errors.category ? (
              <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{errors.category}</Text>
            ) : null}
          </View>

          {/* description + optional title */}
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

          {/* photos */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("photosLabel", { n: MAX_PHOTOS })} />
            <View style={{ ...ROW, gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              {photos.length < MAX_PHOTOS ? (
                <Pressable
                  onPress={pickPhotos}
                  style={{
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
                  }}
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
                  <Pressable
                    onPress={() => setPhotos((prev) => prev.filter((p) => p !== uri))}
                    hitSlop={8}
                    style={{
                      position: "absolute",
                      top: -6,
                      left: -6,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
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

          {/* location */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("locationLabel")} />
            <Pressable
              onPress={() => setCityModal(true)}
              style={{
                ...ROW,
                justifyContent: "space-between",
                backgroundColor: colors.card,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: 14,
                paddingVertical: 13,
              }}
            >
              <Text style={{ color: selectedCity ? colors.text : colors.faint, fontSize: 15 }}>
                {selectedCity ? loc(selectedCity, "name") : t("chooseCity")}
              </Text>
              <Ionicons name="chevron-down" size={17} color={colors.faint} />
            </Pressable>
            <Input
              label={t("addressLabel")}
              placeholder={t("addressPlaceholder")}
              value={address}
              onChangeText={setAddress}
            />
            <View style={{ ...ROW, gap: 8 }}>
              <Chip
                label={locating ? t("loading") : t("useMyLocation")}
                icon="crosshairs-gps"
                active={coords !== null}
                onPress={useMyLocation}
              />
            </View>
            {coords ? (
              <View style={{ gap: 6 }}>
                <View style={{ borderRadius: radius.md, overflow: "hidden", ...shadows.card }}>
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

          {/* schedule */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t("scheduleLabel")} />
            <View style={{ ...ROW, gap: 8 }}>
              <Chip
                label={t("asap")}
                icon="flash"
                active={scheduleMode === "asap"}
                onPress={() => {
                  setScheduleMode("asap");
                  setErrors((e) => ({ ...e, schedule: undefined }));
                }}
              />
              <Chip
                label={t("pickTime")}
                icon="calendar-clock"
                active={scheduleMode === "pick"}
                onPress={() => {
                  setScheduleMode("pick");
                  if (!pickedDate) setCalendarOpen(true);
                }}
              />
            </View>
            {scheduleMode === "pick" ? (
              <View style={{ gap: spacing.md }}>
                {/* date — opens the month grid */}
                <Pressable
                  onPress={() => setCalendarOpen(true)}
                  style={{
                    ...ROW,
                    justifyContent: "space-between",
                    backgroundColor: colors.card,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                  }}
                >
                  <View style={{ ...ROW, gap: 8 }}>
                    <Ionicons name="calendar-outline" size={17} color={colors.brand} />
                    <Text style={{ color: pickedDate ? colors.text : colors.faint, fontSize: 15 }}>
                      {pickedDate ? dateLabel(pickedDate) : t("chooseDate")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={17} color={colors.faint} />
                </Pressable>

                {/* time — half-hour slots, RTL strip starting from the right */}
                <View style={{ gap: 8 }}>
                  <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, fontWeight: "700" }]}>
                    {t("chooseHour")}
                  </Text>
                  <FlatList
                    data={TIME_SLOTS}
                    horizontal
                    inverted
                    keyExtractor={(s) => s}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                    renderItem={({ item }) => {
                      const past =
                        pickedDate !== null &&
                        isToday(pickedDate) &&
                        composeAt(pickedDate, item).getTime() <= now.getTime();
                      return (
                        <View style={{ opacity: past ? 0.35 : 1 }}>
                          <Chip
                            label={item}
                            active={pickedSlot === item}
                            onPress={
                              past
                                ? undefined
                                : () => {
                                    setPickedSlot(item);
                                    setErrors((e) => ({ ...e, schedule: undefined }));
                                  }
                            }
                          />
                        </View>
                      );
                    }}
                  />
                </View>

                {pickedDate && pickedSlot ? (
                  <View style={{ ...ROW, gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                    <Text style={[RTL_TEXT, { color: colors.success, fontSize: 12.5, flex: 1 }]}>
                      {t("scheduleSummary", { date: dateLabel(pickedDate), time: pickedSlot })}
                    </Text>
                  </View>
                ) : null}
                {errors.schedule ? (
                  <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{errors.schedule}</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* completion meter — guidance for a request pros will actually answer */}
          <Card style={{ gap: 10 }}>
            <View style={{ ...ROW, gap: 12 }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: complete ? colors.success : colors.brand }}>
                {pct}%
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800" }]}>
                  {t("meterTitle")}
                </Text>
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12, marginTop: 1 }]}>
                  {complete ? t("meterReady") : t("meterRemaining", { n: checks.length - doneCount })}
                </Text>
              </View>
            </View>
            <View style={{ height: 7, borderRadius: radius.full, backgroundColor: colors.chip, overflow: "hidden" }}>
              <View
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: radius.full,
                  backgroundColor: complete ? colors.success : colors.brand,
                }}
              />
            </View>
            <View style={{ ...ROW, flexWrap: "wrap", gap: 10, marginTop: 2 }}>
              {checks.map((c) => (
                <View key={c.key} style={{ ...ROW, gap: 4 }}>
                  <Ionicons
                    name={c.done ? "checkmark-circle" : "ellipse-outline"}
                    size={15}
                    color={c.done ? colors.success : colors.border}
                  />
                  <Text style={{ fontSize: 11.5, fontWeight: "600", color: c.done ? colors.text : colors.muted }}>
                    {c.label}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

        </ScrollView>

        {/* sticky submit — always visible below the form */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            ...shadows.floatUp,
          }}
        >
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

      {/* date picker */}
      <CalendarModal
        visible={calendarOpen}
        value={pickedDate}
        title={t("chooseDate")}
        minDate={todayStart}
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setPickedDate(d);
          setCalendarOpen(false);
          // moving back to today can push the chosen slot into the past
          if (pickedSlot && isToday(d) && composeAt(d, pickedSlot).getTime() <= Date.now()) setPickedSlot(null);
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
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{t("chooseCity")}</Text>
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
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, paddingVertical: 24, textAlign: "center" }]}>
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
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ ...ROW, gap: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: cityId === item.id ? "800" : "500" }}>
                      {loc(item, "name")}
                    </Text>
                    {item.area ? <Text style={{ color: colors.faint, fontSize: 12 }}>{item.area}</Text> : null}
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
