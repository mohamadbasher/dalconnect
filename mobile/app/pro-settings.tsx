// Pro settings — business info, categories, working hours, verification, gallery.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchCategories, fetchCities } from "../lib/refdata";
import { uploadImage } from "../lib/upload";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Badge, Button, Card, Chip, Input, Loading, SearchBar, SectionHeader } from "../components/ui";
import type { Category, City, GalleryItem, Professional, VerificationStatus } from "../lib/types";

type WorkingHours = Record<string, { from: string; to: string } | null>;

const HOURS = Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`);
const DAY_KEYS = ["day0", "day1", "day2", "day3", "day4", "day5", "day6"];
const MAX_GALLERY = 12;

export default function ProSettingsScreen() {
  const { colors, shadows } = useTheme();
  const { t, loc } = useI18n();
  const { session, isPro, professional, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // section 1 — business info
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [bio, setBio] = useState("");
  const [cityId, setCityId] = useState<number | null>(null);
  const [cityModal, setCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  // section 2 — categories
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [savingCats, setSavingCats] = useState(false);

  // section 3 — working hours
  const [wh, setWh] = useState<WorkingHours>({});
  const [timeModal, setTimeModal] = useState<{ day: number; field: "from" | "to" } | null>(null);
  const [savingHours, setSavingHours] = useState(false);

  // section 4 — verification
  const [verification, setVerification] = useState<VerificationStatus>("none");
  const [uploadingId, setUploadingId] = useState(false);

  // section 5 — gallery
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // transient "saved" feedback per section
  type SavedSection = "info" | "cats" | "hours" | "verify" | "gallery";
  const [savedSection, setSavedSection] = useState<SavedSection | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const [{ data: proRow }, { data: pcs }, { data: gal }, cs, cats] = await Promise.all([
        supabase.from("professionals").select("*").eq("id", uid).maybeSingle(),
        supabase.from("professional_categories").select("category_id").eq("professional_id", uid),
        supabase
          .from("gallery_items")
          .select("*")
          .eq("professional_id", uid)
          .order("created_at", { ascending: false }),
        fetchCities(),
        fetchCategories(),
      ]);
      const p = proRow as unknown as Professional | null;
      if (p) {
        setName(p.business_name);
        setBio(p.bio);
        setCityId(p.city_id);
        setWh((p.working_hours as WorkingHours) ?? {});
        setVerification(p.verification_status);
      }
      setSelectedCats(((pcs ?? []) as any[]).map((r) => r.category_id as number));
      setGallery((gal as unknown as GalleryItem[]) ?? []);
      setCities(cs);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim();
    if (!q) return cities;
    return cities.filter((c) => c.name_ar.includes(q) || c.name_he.includes(q));
  }, [cities, citySearch]);

  if (!uid) return <Redirect href="/(auth)/welcome" />;
  if (!isPro || !professional) return <Redirect href="/become-pro" />;
  if (loading) return <Loading />;

  const selectedCity = cities.find((c) => c.id === cityId) ?? null;
  const showSaved = (section: SavedSection) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSavedSection(section);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedSection(null), 2500);
  };
  const SavedNote = ({ section }: { section: SavedSection }) =>
    savedSection === section ? (
      <View style={{ ...ROW, gap: 6, justifyContent: "center" }}>
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <Text style={{ color: colors.success, fontSize: 13, fontWeight: "700" }}>{t("saved")}</Text>
      </View>
    ) : null;

  // ---------- section handlers ----------
  const saveInfo = async () => {
    if (!name.trim()) {
      setNameError(t("businessNameRequired"));
      return;
    }
    setSavingInfo(true);
    const { error } = await supabase
      .from("professionals")
      .update({ business_name: name.trim(), bio: bio.trim(), city_id: cityId })
      .eq("id", uid);
    setSavingInfo(false);
    if (error) Alert.alert(t("error"));
    else {
      showSaved("info");
      refresh().catch(() => {});
    }
  };

  const toggleCat = (id: number) => {
    setSelectedCats((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= 5) {
        Alert.alert(t("maxCategoriesMsg"));
        return prev;
      }
      return [...prev, id];
    });
  };

  const saveCats = async () => {
    if (selectedCats.length === 0) {
      Alert.alert(t("minCategoriesMsg"));
      return;
    }
    setSavingCats(true);
    try {
      const { error: delErr } = await supabase
        .from("professional_categories")
        .delete()
        .eq("professional_id", uid);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase
        .from("professional_categories")
        .insert(selectedCats.map((category_id) => ({ professional_id: uid, category_id })));
      if (insErr) throw insErr;
      showSaved("cats");
    } catch {
      Alert.alert(t("error"));
    } finally {
      setSavingCats(false);
    }
  };

  const toggleDay = (day: number, on: boolean) => {
    setWh((prev) => ({ ...prev, [String(day)]: on ? { from: "08:00", to: "18:00" } : null }));
  };

  const setDayTime = (day: number, field: "from" | "to", value: string) => {
    setWh((prev) => {
      const cur = prev[String(day)] ?? { from: "08:00", to: "18:00" };
      return { ...prev, [String(day)]: { ...cur, [field]: value } };
    });
  };

  const saveHours = async () => {
    setSavingHours(true);
    const { error } = await supabase.from("professionals").update({ working_hours: wh }).eq("id", uid);
    setSavingHours(false);
    if (error) Alert.alert(t("error"));
    else showSaved("hours");
  };

  const uploadIdDoc = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (result.canceled || !result.assets?.length) return;
      setUploadingId(true);
      const path = await uploadImage({
        bucket: "id-documents",
        userId: uid,
        localUri: result.assets[0].uri,
        fileName: `id-${Date.now()}.jpg`,
      });
      const { error } = await supabase
        .from("professionals")
        .update({ id_document_url: path, verification_status: "pending" })
        .eq("id", uid);
      if (error) throw error;
      setVerification("pending");
      refresh().catch(() => {});
      showSaved("verify");
    } catch {
      Alert.alert(t("uploadFailed"));
    } finally {
      setUploadingId(false);
    }
  };

  const addGalleryPhoto = async () => {
    if (gallery.length >= MAX_GALLERY) {
      Alert.alert(t("galleryFull"));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      setUploadingGallery(true);
      const url = await uploadImage({
        bucket: "gallery",
        userId: uid,
        localUri: result.assets[0].uri,
        fileName: `g-${Date.now()}.jpg`,
      });
      const { data, error } = await supabase
        .from("gallery_items")
        .insert({ professional_id: uid, image_url: url })
        .select("*")
        .single();
      if (error) throw error;
      setGallery((prev) => [data as unknown as GalleryItem, ...prev]);
      showSaved("gallery");
    } catch {
      Alert.alert(t("uploadFailed"));
    } finally {
      setUploadingGallery(false);
    }
  };

  const deleteGalleryItem = (item: GalleryItem) => {
    Alert.alert(t("deletePhotoTitle"), t("deletePhotoMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("gallery_items").delete().eq("id", item.id);
          if (error) Alert.alert(t("error"));
          else setGallery((prev) => prev.filter((g) => g.id !== item.id));
        },
      },
    ]);
  };

  // gallery tile sizing: screen padding 16 + card padding 16 each side, 8 gaps
  const tileSize = Math.floor((Dimensions.get("window").width - (spacing.lg + spacing.lg) * 2 - 16) / 3);

  const verificationCard = () => {
    if (verification === "approved") {
      return (
        <View style={{ ...ROW, gap: 8 }}>
          <MaterialCommunityIcons name="check-decagram" size={22} color={colors.success} />
          <Badge label={t("verified")} tone="success" />
        </View>
      );
    }
    if (verification === "pending") {
      return (
        <View style={{ ...ROW, gap: 8 }}>
          <MaterialCommunityIcons name="clock-outline" size={22} color={colors.gold} />
          <Badge label={t("verifyPendingLabel")} tone="gold" />
        </View>
      );
    }
    if (verification === "rejected") {
      return (
        <View style={{ gap: spacing.md }}>
          <View style={{ ...ROW, gap: 8 }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.danger} />
            <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 13, fontWeight: "600", flexShrink: 1 }]}>
              {t("verifyRejectedHint")}
            </Text>
          </View>
          <Button title={t("reupload")} icon="upload" variant="outline" loading={uploadingId} onPress={uploadIdDoc} />
        </View>
      );
    }
    return (
      <View style={{ gap: spacing.md }}>
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>{t("verifyNoneHint")}</Text>
        <Button title={t("verifyCta")} icon="shield-check" loading={uploadingId} onPress={uploadIdDoc} />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header */}
      <View
        style={{
          ...ROW,
          gap: 12,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{t("proSettingsTitle")}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1 — business info */}
          <Card style={{ gap: spacing.md }}>
            <SectionHeader title={t("businessInfoTitle")} />
            <Input
              label={t("businessNameLabel")}
              value={name}
              onChangeText={(v) => {
                setName(v);
                setNameError(undefined);
              }}
              error={nameError}
            />
            <Input
              label={t("bioLabel")}
              value={bio}
              onChangeText={setBio}
              multiline
              style={{ minHeight: 84, textAlignVertical: "top" }}
            />
            <View style={{ gap: 6 }}>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, fontWeight: "600" }]}>
                {t("cityLabel")}
              </Text>
              <Pressable
                onPress={() => setCityModal(true)}
                style={{
                  ...ROW,
                  justifyContent: "space-between",
                  backgroundColor: colors.bg,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                }}
              >
                <Text style={{ color: selectedCity ? colors.text : colors.faint, fontSize: 15 }}>
                  {selectedCity ? loc(selectedCity, "name") : t("selectCity")}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.faint} />
              </Pressable>
            </View>
            <Button title={t("save")} icon="content-save" loading={savingInfo} onPress={saveInfo} />
            <SavedNote section="info" />
          </Card>

          {/* 2 — categories */}
          <Card style={{ gap: spacing.md }}>
            <SectionHeader title={t("myCategoriesTitle")} />
            <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{t("pickCategoriesHint")}</Text>
            <View style={{ ...ROW, flexWrap: "wrap", gap: 10, justifyContent: "flex-start" }}>
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  label={loc(c, "name")}
                  icon={c.icon as any}
                  active={selectedCats.includes(c.id)}
                  onPress={() => toggleCat(c.id)}
                />
              ))}
            </View>
            <Button title={t("save")} icon="content-save" loading={savingCats} onPress={saveCats} />
            <SavedNote section="cats" />
          </Card>

          {/* 3 — working hours */}
          <Card style={{ gap: spacing.md }}>
            <SectionHeader title={t("workingHoursTitle")} />
            {DAY_KEYS.map((dayKey, day) => {
              const cur = wh[String(day)] ?? null;
              return (
                <View key={dayKey} style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                  <View style={{ ...ROW, gap: 8, width: 118 }}>
                    <Switch
                      value={!!cur}
                      onValueChange={(v) => toggleDay(day, v)}
                      trackColor={{ false: colors.chip, true: colors.brand }}
                      thumbColor={colors.onBrand}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ color: cur ? colors.text : colors.faint, fontSize: 13.5, fontWeight: "700", flexShrink: 1 }}
                    >
                      {t(dayKey)}
                    </Text>
                  </View>
                  {cur ? (
                    <View style={{ ...ROW, gap: 6 }}>
                      <Chip
                        label={`${t("fromLabel")} ${cur.from}`}
                        onPress={() => setTimeModal({ day, field: "from" })}
                      />
                      <Chip
                        label={`${t("toLabel")} ${cur.to}`}
                        onPress={() => setTimeModal({ day, field: "to" })}
                      />
                    </View>
                  ) : (
                    <Text style={{ color: colors.faint, fontSize: 12.5 }}>{t("closedLabel")}</Text>
                  )}
                </View>
              );
            })}
            <Button title={t("save")} icon="content-save" loading={savingHours} onPress={saveHours} />
            <SavedNote section="hours" />
          </Card>

          {/* 4 — verification */}
          <Card style={{ gap: spacing.md }}>
            <SectionHeader title={t("verificationTitle")} />
            {verificationCard()}
            <SavedNote section="verify" />
          </Card>

          {/* 5 — gallery */}
          <Card style={{ gap: spacing.md }}>
            <SectionHeader title={t("galleryTitle")} />
            <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{t("galleryHint")}</Text>
            <View style={{ ...ROW, flexWrap: "wrap", gap: 8, justifyContent: "flex-start", alignItems: "flex-start" }}>
              {gallery.length < MAX_GALLERY ? (
                <Pressable
                  onPress={addGalleryPhoto}
                  disabled={uploadingGallery}
                  style={{
                    width: tileSize,
                    height: tileSize,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: colors.brand,
                    backgroundColor: colors.brandTint,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: uploadingGallery ? 0.5 : 1,
                  }}
                >
                  <MaterialCommunityIcons
                    name={uploadingGallery ? "progress-upload" : "plus"}
                    size={26}
                    color={colors.brand}
                  />
                </Pressable>
              ) : null}
              {gallery.map((g) => (
                <View key={g.id} style={{ width: tileSize, height: tileSize }}>
                  <Image
                    source={{ uri: g.image_url }}
                    style={{ width: tileSize, height: tileSize, borderRadius: radius.md, backgroundColor: colors.chip }}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => deleteGalleryItem(g)}
                    hitSlop={6}
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 4,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.overlay,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close" size={14} color={colors.onBrand} />
                  </Pressable>
                </View>
              ))}
            </View>
            <SavedNote section="gallery" />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* city picker bottom sheet */}
      <Modal visible={cityModal} transparent animationType="slide" onRequestClose={() => setCityModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay }}>
          <Pressable style={{ flex: 1 }} onPress={() => setCityModal(false)} />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              maxHeight: "70%",
              gap: spacing.md,
            }}
          >
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800" }]}>{t("selectCity")}</Text>
            <SearchBar value={citySearch} onChangeText={setCitySearch} placeholder={t("searchCity")} />
            <FlatList
              data={filteredCities}
              keyExtractor={(c) => String(c.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCityId(item.id);
                    setCityModal(false);
                  }}
                  style={{
                    ...ROW,
                    justifyContent: "space-between",
                    paddingVertical: 13,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: cityId === item.id ? "800" : "500" }}>
                    {loc(item, "name")}
                  </Text>
                  {cityId === item.id ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* hour picker bottom sheet */}
      <Modal visible={!!timeModal} transparent animationType="slide" onRequestClose={() => setTimeModal(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay }}>
          <Pressable style={{ flex: 1 }} onPress={() => setTimeModal(null)} />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              gap: spacing.md,
            }}
          >
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800" }]}>
              {t("selectHour")}
            </Text>
            <View style={{ ...ROW, flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
              {HOURS.map((h) => {
                const active =
                  !!timeModal && (wh[String(timeModal.day)] ?? { from: "", to: "" })[timeModal.field] === h;
                return (
                  <Chip
                    key={h}
                    label={h}
                    active={active}
                    onPress={() => {
                      if (timeModal) setDayTime(timeModal.day, timeModal.field, h);
                      setTimeModal(null);
                    }}
                  />
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
