// Become-a-professional upgrade wizard: business info -> categories -> ID verification.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import * as Haptics from "expo-haptics";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchCategories, fetchCities } from "../lib/refdata";
import { uploadImage } from "../lib/upload";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button, Chip, Input, Loading, SearchBar } from "../components/ui";
import type { Category, City } from "../lib/types";

export default function BecomeProScreen() {
  const { colors, shadows } = useTheme();
  const { t, loc } = useI18n();
  const { session, isPro, professional, refresh, setMode } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = session?.user?.id ?? null;
  const submittedRef = useRef(false);

  const [step, setStep] = useState(0);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refLoading, setRefLoading] = useState(true);

  // step 1
  const [businessName, setBusinessName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [bio, setBio] = useState("");
  const [cityId, setCityId] = useState<number | null>(null);
  const [cityModal, setCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  // step 2
  const [selectedCats, setSelectedCats] = useState<number[]>([]);

  // step 3
  const [idLocalUri, setIdLocalUri] = useState<string | null>(null);
  const [idPath, setIdPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([fetchCities(), fetchCategories()])
      .then(([cs, cats]) => {
        setCities(cs);
        setCategories(cats);
      })
      .catch(() => {})
      .finally(() => setRefLoading(false));
  }, []);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim();
    if (!q) return cities;
    return cities.filter((c) => c.name_ar.includes(q) || c.name_he.includes(q));
  }, [cities, citySearch]);

  if (isPro && professional && !submittedRef.current) {
    return <Redirect href="/(tabs)/dashboard" />;
  }
  if (!uid) return <Redirect href="/(auth)/welcome" />;

  const selectedCity = cities.find((c) => c.id === cityId) ?? null;

  const pickId = async (fromCamera: boolean) => {
    try {
      const result = fromCamera
        ? await (async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return null;
            return ImagePicker.launchCameraAsync({ quality: 0.7 });
          })()
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (!result || result.canceled || !result.assets?.length) return;
      const uri = result.assets[0].uri;
      setIdLocalUri(uri);
      setUploading(true);
      const path = await uploadImage({
        bucket: "id-documents",
        userId: uid,
        localUri: uri,
        fileName: `id-${Date.now()}.jpg`,
      });
      setIdPath(path);
    } catch {
      setIdLocalUri(null);
      setIdPath(null);
      Alert.alert(t("uploadFailed"));
    } finally {
      setUploading(false);
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

  const next = () => {
    if (step === 0) {
      if (!businessName.trim()) {
        setNameError(t("businessNameRequired"));
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (selectedCats.length === 0) {
        Alert.alert(t("minCategoriesMsg"));
        return;
      }
      setStep(2);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("become_professional", {
        p_business_name: businessName.trim(),
        p_bio: bio.trim(),
        p_city_id: cityId,
        p_category_ids: selectedCats,
        p_id_document_url: idPath,
      });
      if (error) throw error;
      submittedRef.current = true;
      await refresh();
      setMode("pro");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/(tabs)/dashboard");
    } catch {
      Alert.alert(t("error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (refLoading) return <Loading />;

  const stepTitles = [t("stepBusiness"), t("stepCategories"), t("stepVerification")];

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
        <Pressable onPress={() => (step > 0 ? setStep(step - 1) : router.back())} hitSlop={10}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{t("becomeProTitle")}</Text>
      </View>

      {/* progress dots — completed steps are tappable to go back */}
      <View style={{ ...ROW, justifyContent: "center", gap: 8, paddingVertical: spacing.sm }}>
        {[0, 1, 2].map((i) => (
          <Pressable
            key={i}
            disabled={i >= step}
            onPress={() => setStep(i)}
            hitSlop={8}
            style={{
              width: i === step ? 26 : 9,
              height: 9,
              borderRadius: radius.full,
              backgroundColor: i <= step ? colors.brand : colors.chip,
              opacity: i < step ? 0.55 : 1,
            }}
          />
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "700", textAlign: "center", marginBottom: spacing.sm }}>
        {stepTitles[step]}
      </Text>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 ? (
            <View style={{ gap: spacing.lg }}>
              <Input
                label={t("businessNameLabel")}
                placeholder={t("businessNamePlaceholder")}
                value={businessName}
                onChangeText={(v) => {
                  setBusinessName(v);
                  setNameError(undefined);
                }}
                error={nameError}
              />
              <Input
                label={`${t("bioLabel")} (${t("optional")})`}
                placeholder={t("bioPlaceholder")}
                value={bio}
                onChangeText={setBio}
                multiline
                style={{ minHeight: 96, textAlignVertical: "top" }}
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
                    backgroundColor: colors.card,
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
              <Button title={t("next")} icon="arrow-left" onPress={next} />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={{ gap: spacing.lg }}>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5 }]}>{t("pickCategoriesHint")}</Text>
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
              <Button title={t("next")} icon="arrow-left" onPress={next} />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ gap: spacing.lg }}>
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  padding: spacing.xl,
                  alignItems: "center",
                  gap: spacing.md,
                  ...shadows.card,
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.goldTint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="shield-check" size={30} color={colors.gold} />
                </View>
                <Text style={[RTL_TEXT, { color: colors.text, fontSize: 14, fontWeight: "700", textAlign: "center" }]}>
                  {t("idHint")}
                </Text>
                <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, textAlign: "center" }]}>
                  {t("idPrivacyNote")}
                </Text>

                {idLocalUri ? (
                  <Image
                    source={{ uri: idLocalUri }}
                    style={{ width: 180, height: 116, borderRadius: radius.md, backgroundColor: colors.chip }}
                    contentFit="cover"
                  />
                ) : null}

                <View style={{ ...ROW, gap: 10 }}>
                  <Button
                    title={t("takePhoto")}
                    icon="camera"
                    variant="outline"
                    small
                    loading={uploading}
                    onPress={() => pickId(true)}
                  />
                  <Button
                    title={t("pickFromGallery")}
                    icon="image-multiple"
                    variant="outline"
                    small
                    disabled={uploading}
                    onPress={() => pickId(false)}
                  />
                </View>
              </View>

              <Button
                title={t("submitPro")}
                icon="briefcase-check"
                loading={submitting}
                disabled={uploading}
                onPress={submit}
              />
              {!idPath ? (
                <Pressable
                  onPress={submit}
                  disabled={submitting || uploading}
                  hitSlop={8}
                  style={({ pressed }) => ({ paddingVertical: 8, opacity: pressed || submitting || uploading ? 0.5 : 1 })}
                >
                  <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "700", textAlign: "center" }}>
                    {t("skip")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
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
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800" }]}>
              {t("selectCity")}
            </Text>
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
    </View>
  );
}
