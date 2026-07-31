// Edit profile — avatar, full name, city. Phone is the login and stays read-only.
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { uploadImage } from "../lib/upload";
import { fetchCities } from "../lib/refdata";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Avatar, Button, Input, Loading, SearchBar } from "../components/ui";
import type { City } from "../lib/types";

export default function EditProfileScreen() {
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session, profile, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [cityId, setCityId] = useState<number | null>(profile?.city_id ?? null);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [cities, setCities] = useState<City[]>([]);
  const [citySheet, setCitySheet] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setCityId(profile.city_id);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchCities().then(setCities).catch(() => {});
  }, []);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim();
    if (!q) return cities;
    return cities.filter((c) => c.name_ar.includes(q) || c.name_he.includes(q));
  }, [cities, citySearch]);

  const selectedCity = cities.find((c) => c.id === cityId) ?? null;

  if (!profile || !session?.user) return <Loading />;

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadImage({
        bucket: "avatars",
        userId: session.user.id,
        localUri: result.assets[0].uri,
        fileName: `${Date.now()}.jpg`,
      });
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", session.user.id);
      if (error) throw error;
      await refresh();
    } catch {
      Alert.alert(t("error"), t("editUploadError"));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const name = fullName.trim();
    if (!name) {
      setNameError(t("editFullNameRequired"));
      return;
    }
    setNameError("");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name, city_id: cityId })
        .eq("id", session.user.id);
      if (error) throw error;
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch {
      Alert.alert(t("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header */}
      <View
        style={{
          ...ROW,
          gap: spacing.md,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
          {t("profileEditProfile")}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* avatar picker */}
          <View style={{ alignItems: "center" }}>
            <Pressable onPress={pickAvatar} disabled={uploading}>
              <Avatar uri={profile.avatar_url} name={profile.full_name} size={104} />
              {uploading ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 52,
                    backgroundColor: colors.overlay,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.brand,
                  borderWidth: 3,
                  borderColor: colors.bg,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadows.card,
                }}
              >
                <Ionicons name="camera" size={16} color={colors.onBrand} />
              </View>
            </Pressable>
          </View>

          {/* full name */}
          <Input
            label={t("editFullName")}
            value={fullName}
            onChangeText={(v) => {
              setFullName(v);
              if (nameError) setNameError("");
            }}
            error={nameError}
            autoCapitalize="words"
          />

          {/* city picker */}
          <View style={{ gap: 6 }}>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, fontWeight: "600" }]}>{t("city")}</Text>
            <Pressable
              onPress={() => setCitySheet(true)}
              style={{
                ...ROW,
                gap: 8,
                backgroundColor: colors.card,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: 14,
                paddingVertical: 13,
              }}
            >
              <Text
                style={[
                  RTL_TEXT,
                  { flex: 1, fontSize: 15, color: selectedCity ? colors.text : colors.faint },
                ]}
              >
                {selectedCity ? loc(selectedCity, "name") : t("editChooseCity")}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.faint} />
            </Pressable>
          </View>

          {/* phone (read-only) */}
          <View style={{ gap: 6 }}>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, fontWeight: "600" }]}>{t("editPhone")}</Text>
            <View
              style={{
                backgroundColor: colors.chip,
                borderRadius: radius.md,
                paddingHorizontal: 14,
                paddingVertical: 13,
                ...ROW,
                gap: 8,
              }}
            >
              <Ionicons name="lock-closed-outline" size={15} color={colors.faint} />
              <Text style={{ flex: 1, fontSize: 15, color: colors.muted, textAlign: "right", writingDirection: "ltr" }}>
                {"‎" + profile.phone}
              </Text>
            </View>
            <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{t("editPhoneNote")}</Text>
          </View>

          <Button title={t("save")} onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* city bottom sheet */}
      <Modal visible={citySheet} transparent animationType="slide" onRequestClose={() => setCitySheet(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setCitySheet(false)} />
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: spacing.md,
              maxHeight: "72%",
              paddingBottom: insets.bottom + spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 5,
                borderRadius: 3,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: spacing.md,
              }}
            />
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>
                {t("editChooseCity")}
              </Text>
              <SearchBar value={citySearch} onChangeText={setCitySearch} placeholder={t("editSearchCity")} />
            </View>
            <FlatList
              data={filteredCities}
              keyExtractor={(c) => String(c.id)}
              contentContainerStyle={{ padding: spacing.lg, gap: 4 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.id === cityId;
                return (
                  <Pressable
                    onPress={() => {
                      setCityId(item.id);
                      setCitySheet(false);
                      setCitySearch("");
                    }}
                    style={{
                      ...ROW,
                      gap: 8,
                      paddingVertical: 12,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: active ? colors.brandTint : "transparent",
                    }}
                  >
                    <Text
                      style={[
                        RTL_TEXT,
                        {
                          flex: 1,
                          fontSize: 15,
                          color: active ? colors.brand : colors.text,
                          fontWeight: active ? "700" : "500",
                        },
                      ]}
                    >
                      {loc(item, "name")}
                    </Text>
                    {active ? <Ionicons name="checkmark-circle" size={19} color={colors.brand} /> : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={{ color: colors.muted, textAlign: "center", paddingVertical: spacing.xl }}>
                  {t("noResults")}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
