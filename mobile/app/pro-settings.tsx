// Pro settings — business info, categories, working hours, verification, gallery.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchCategories, fetchCities } from "../lib/refdata";
import { uploadImage } from "../lib/upload";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { todayHoursLabel } from "../lib/hours";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Input,
  Loading,
  SearchBar,
  SectionHeader,
  StarRating,
} from "../components/ui";
import { HoursEditor, type WorkingHours } from "../components/HoursEditor";
import { useToast } from "../components/Toast";
import type { Category, City, GalleryItem, Professional, VerificationStatus } from "../lib/types";

const MAX_GALLERY = 12;

export default function ProSettingsScreen() {
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session, profile, isPro, professional, refresh } = useAuth();
  const toast = useToast();
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
  const [savingHours, setSavingHours] = useState(false);

  // section 4 — verification
  const [verification, setVerification] = useState<VerificationStatus>("none");
  const [uploadingId, setUploadingId] = useState(false);

  // section 5 — gallery
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // public-profile preview
  const [previewOpen, setPreviewOpen] = useState(false);

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
  // Not a professional: there is nothing to configure, and /become-pro is no
  // longer a route a customer can complete — professionals register on their
  // own track from the login screen. Send them back to their own profile.
  if (!isPro || !professional) return <Redirect href="/(tabs)/profile" />;
  if (loading) return <Loading />;

  const selectedCity = cities.find((c) => c.id === cityId) ?? null;
  const selectedCategories = categories.filter((c) => selectedCats.includes(c.id));

  // what's still missing from the public-facing profile
  const missing: string[] = [];
  if (!profile?.avatar_url) missing.push(t("missingPhoto"));
  if (bio.trim().length < 10) missing.push(t("missingBio"));
  if (gallery.length === 0) missing.push(t("missingGallery"));
  if (verification !== "approved") missing.push(t("missingVerification"));

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
    if (error) toast.error(t("error"));
    else {
      toast.success(t("saved"));
      refresh().catch(() => {});
    }
  };

  const toggleCat = (id: number) => {
    setSelectedCats((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= 5) {
        toast.info(t("maxCategoriesMsg"));
        return prev;
      }
      return [...prev, id];
    });
  };

  const saveCats = async () => {
    if (selectedCats.length === 0) {
      toast.info(t("minCategoriesMsg"));
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
      toast.success(t("saved"));
    } catch {
      toast.error(t("error"));
    } finally {
      setSavingCats(false);
    }
  };

  const saveHours = async () => {
    setSavingHours(true);
    const { error } = await supabase.from("professionals").update({ working_hours: wh }).eq("id", uid);
    setSavingHours(false);
    if (error) toast.error(t("error"));
    else {
      toast.success(t("saved"));
      refresh().catch(() => {});
    }
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
      toast.success(t("saved"));
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setUploadingId(false);
    }
  };

  const addGalleryPhoto = async () => {
    if (gallery.length >= MAX_GALLERY) {
      toast.info(t("galleryFull"));
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
      toast.success(t("saved"));
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setUploadingGallery(false);
    }
  };

  // destructive — stays a real confirm dialog
  const deleteGalleryItem = (item: GalleryItem) => {
    Alert.alert(t("deletePhotoTitle"), t("deletePhotoMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("gallery_items").delete().eq("id", item.id);
          if (error) toast.error(t("error"));
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
          {/* see-it-as-a-customer preview */}
          <Pressable
            onPress={() => setPreviewOpen(true)}
            style={({ pressed }) => ({
              ...ROW,
              gap: 10,
              backgroundColor: colors.brandTint,
              borderWidth: 1.5,
              borderColor: colors.brand,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: 13,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Ionicons name="eye-outline" size={20} color={colors.brand} />
            <Text style={[RTL_TEXT, { color: colors.brand, fontSize: 14.5, fontWeight: "800", flex: 1 }]}>
              {t("previewCta")}
            </Text>
            {missing.length ? (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 6,
                  borderRadius: radius.full,
                  backgroundColor: colors.warnTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.warn, fontSize: 11.5, fontWeight: "800" }}>{missing.length}</Text>
              </View>
            ) : null}
          </Pressable>

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
          </Card>

          {/* 3 — working hours */}
          <Card style={{ gap: spacing.md }}>
            <SectionHeader title={t("workingHoursTitle")} />
            <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{t("hoursHint")}</Text>
            <HoursEditor value={wh} onChange={setWh} />
            <Button title={t("save")} icon="content-save" loading={savingHours} onPress={saveHours} />
          </Card>

          {/* 4 — verification */}
          <Card style={{ gap: spacing.md }}>
            <SectionHeader title={t("verificationTitle")} />
            {verificationCard()}
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
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* city picker bottom sheet — the search field opens a keyboard, and a
          bottom sheet sits exactly where the keyboard appears */}
      <Modal visible={cityModal} transparent animationType="slide" onRequestClose={() => setCityModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: colors.overlay }}
        >
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
            <SearchBar value={citySearch} onChangeText={setCitySearch} placeholder={t("proSearchCity")} />
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
        </KeyboardAvoidingView>
      </Modal>

      {/* public-profile preview — "how a customer sees you" */}
      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={{
              ...ROW,
              gap: 12,
              paddingTop: insets.top + 8,
              paddingBottom: 12,
              paddingHorizontal: spacing.lg,
              backgroundColor: colors.card,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => setPreviewOpen(false)}
              hitSlop={10}
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.full,
                backgroundColor: colors.chip,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800" }]}>
                {t("previewTitle")}
              </Text>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>{t("previewSubtitle")}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
            {/* what's still missing */}
            <View
              style={{
                ...ROW,
                gap: 8,
                backgroundColor: missing.length ? colors.warnTint : colors.successTint,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              <Ionicons
                name={missing.length ? "alert-circle" : "checkmark-circle"}
                size={16}
                color={missing.length ? colors.warn : colors.success}
              />
              <Text
                style={[
                  RTL_TEXT,
                  {
                    flex: 1,
                    fontSize: 12.5,
                    fontWeight: "700",
                    color: missing.length ? colors.warn : colors.success,
                  },
                ]}
              >
                {missing.length ? t("previewMissing", { items: missing.join("، ") }) : t("previewAllGood")}
              </Text>
            </View>

            {/* the public card */}
            <Card style={{ gap: spacing.md }}>
              <View style={{ ...ROW, gap: 12 }}>
                <Avatar uri={profile?.avatar_url} name={name || profile?.full_name} size={64} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ ...ROW, gap: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800", flexShrink: 1 }]}
                    >
                      {name || t("businessNameLabel")}
                    </Text>
                    {verification === "approved" ? (
                      <MaterialCommunityIcons name="check-decagram" size={18} color={colors.success} />
                    ) : null}
                  </View>
                  {selectedCity ? (
                    <View style={{ ...ROW, gap: 4 }}>
                      <Ionicons name="location-outline" size={13} color={colors.faint} />
                      <Text style={{ color: colors.muted, fontSize: 12.5 }}>{loc(selectedCity, "name")}</Text>
                    </View>
                  ) : null}
                  <View style={{ ...ROW, gap: 6 }}>
                    {professional.rating_count > 0 ? (
                      <>
                        <StarRating rating={professional.rating_avg} size={13} />
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {professional.rating_avg.toFixed(1)} ({professional.rating_count})
                        </Text>
                      </>
                    ) : (
                      <Badge label={t("newPro")} tone="brand" />
                    )}
                  </View>
                </View>
              </View>

              {/* today's hours */}
              <View style={{ ...ROW, gap: 6 }}>
                <Ionicons name="time-outline" size={15} color={colors.brand} />
                <Text style={[RTL_TEXT, { color: colors.text, fontSize: 13, flexShrink: 1 }]}>
                  {todayHoursLabel(wh, lang) ?? t("setHoursHint")}
                </Text>
              </View>

              {/* categories */}
              {selectedCategories.length ? (
                <View style={{ ...ROW, flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
                  {selectedCategories.map((c) => (
                    <View
                      key={c.id}
                      style={{
                        ...ROW,
                        gap: 5,
                        backgroundColor: colors.chip,
                        borderRadius: radius.full,
                        paddingHorizontal: 11,
                        paddingVertical: 6,
                      }}
                    >
                      <MaterialCommunityIcons name={c.icon as any} size={13} color={colors.brand} />
                      <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "600" }}>
                        {loc(c, "name")}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* bio */}
              <Text
                style={[
                  RTL_TEXT,
                  { color: bio.trim() ? colors.text : colors.faint, fontSize: 13.5, lineHeight: 21 },
                ]}
              >
                {bio.trim() || t("noBioYet")}
              </Text>
            </Card>

            {/* gallery strip */}
            <Card style={{ gap: spacing.md }}>
              <SectionHeader title={t("galleryTitle")} />
              {gallery.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, flexDirection: "row-reverse" }}
                >
                  {gallery.map((g) => (
                    <Image
                      key={g.id}
                      source={{ uri: g.image_url }}
                      style={{ width: 110, height: 110, borderRadius: radius.md, backgroundColor: colors.chip }}
                      contentFit="cover"
                    />
                  ))}
                </ScrollView>
              ) : (
                <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 13 }]}>{t("noGalleryYet")}</Text>
              )}
            </Card>
          </ScrollView>

          <View
            style={{
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              backgroundColor: colors.card,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Button title={t("previewBackToEdit")} icon="pencil" onPress={() => setPreviewOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
