// Account settings — preferences, then the irreversible corner.
//
// Language and appearance live here rather than on the profile tab: they are
// set once and rarely touched again, so they were taking prime space on a page
// people open to check their account. Deleting an account is here too, behind
// its own door — everything on the profile tab is reversible, and an
// irreversible action does not belong a tap away from "appearance".
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n, LANG_NAMES } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button, SectionHeader } from "../components/ui";
import { Divider, MenuRow, Segmented, SettingsGroup } from "../components/settings-ui";
import type { Lang } from "../lib/types";

export default function AccountSettingsScreen() {
  const { colors, shadows, mode: themeMode, setMode: setThemeMode } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_account");
      if (error) throw error;
      await signOut();
      router.replace("/(auth)/welcome");
    } catch {
      Alert.alert(t("error"), t("profileDeleteError"));
    } finally {
      setDeleting(false);
    }
  };

  // Two confirms, and the second one names what is lost rather than asking
  // "are you sure?" a second time.
  const confirmDelete = () => {
    Alert.alert(t("profileDeleteAccount"), t("profileDeleteConfirm1"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("profileDeleteContinue"),
        style: "destructive",
        onPress: () => {
          Alert.alert(t("profileDeleteConfirm2Title"), t("profileDeleteConfirm2"), [
            { text: t("cancel"), style: "cancel" },
            { text: t("profileDeleteForever"), style: "destructive", onPress: deleteAccount },
          ]);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
          {t("profileSettings")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* ---------- preferences ---------- */}
        <View>
          <SectionHeader title={t("profileSectionPreferences")} />
          <SettingsGroup>
            <MenuRow icon="language-outline" label={t("language")} hideChevron>
              <Segmented
                options={(["ar", "he"] as Lang[]).map((l) => ({ key: l, label: LANG_NAMES[l] }))}
                value={lang}
                onChange={setLang}
              />
            </MenuRow>
            <Divider />
            <MenuRow icon="moon-outline" label={t("profileAppearance")} hideChevron>
              <Segmented
                options={[
                  { key: "light", icon: "sunny-outline", a11y: t("lightMode") },
                  { key: "dark", icon: "moon-outline", a11y: t("darkMode") },
                  { key: "system", icon: "phone-portrait-outline", a11y: t("systemMode") },
                ]}
                value={themeMode}
                onChange={setThemeMode}
              />
            </MenuRow>
          </SettingsGroup>
        </View>

        {/* ---------- danger zone ---------- */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.dangerTint,
            padding: spacing.lg,
            gap: spacing.md,
            ...shadows.card,
          }}
        >
          <View style={{ ...ROW, alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: colors.dangerTint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </View>
            <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
              {t("profileDeleteAccount")}
            </Text>
          </View>

          <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, lineHeight: 20 }]}>
            {t("profileDeleteExplain")}
          </Text>

          <Button
            title={t("profileDeleteAccount")}
            variant="danger"
            onPress={confirmDelete}
            disabled={deleting}
            loading={deleting}
          />
        </View>
      </ScrollView>
    </View>
  );
}
