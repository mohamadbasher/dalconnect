// Side-menu drawer opened from the hamburger button in TopBar.
// Quick navigation + language/appearance shortcuts + pro mode switch.
import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Linking } from "react-native";
import { useTheme, radius, spacing, ThemeMode } from "../lib/theme";
import { useI18n, LANG_NAMES } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Avatar, Badge } from "./ui";
import type { Lang } from "../lib/types";

const SUPPORT_WHATSAPP_URL = "https://wa.me/972500000000"; // TODO: real support number

function MenuRow({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  const { colors } = useTheme();
  const color = tint ?? colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        ...ROW,
        gap: spacing.md,
        paddingVertical: 13,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          backgroundColor: tint ? colors.brandTint : colors.chip,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={19} color={tint ?? colors.muted} />
      </View>
      <Text style={[RTL_TEXT, { flex: 1, color, fontSize: 14.5, fontWeight: "700" }]}>{label}</Text>
      <Ionicons name="chevron-back" size={16} color={colors.faint} />
    </Pressable>
  );
}

export function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, mode: themeMode, setMode: setThemeMode, dark } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { profile, professional, isPro, mode, setMode } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const go = (path: string) => {
    onClose();
    router.push(path as any);
  };

  const themeOptions: { key: ThemeMode; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "light", icon: "sunny-outline" },
    { key: "dark", icon: "moon-outline" },
    { key: "system", icon: "phone-portrait-outline" },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: "80%",
          maxWidth: 330,
          backgroundColor: colors.bg,
          borderTopLeftRadius: radius.xl,
          borderBottomLeftRadius: radius.xl,
          overflow: "hidden",
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
          {/* header — user card on brand background */}
          <View
            style={{
              backgroundColor: colors.brand,
              paddingTop: insets.top + spacing.lg,
              paddingBottom: spacing.lg,
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
            }}
          >
            <View style={{ ...ROW, justifyContent: "space-between" }}>
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800", writingDirection: "ltr" }}>
                DalConnect
              </Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <Pressable onPress={() => go("/edit-profile")} style={{ ...ROW, gap: spacing.md }}>
              <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={52} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={[RTL_TEXT, { color: "#fff", fontSize: 16, fontWeight: "800" }]}>
                  {profile?.full_name || ""}
                </Text>
                {isPro ? (
                  <Badge
                    label={mode === "pro" ? t("tabDashboard") : t("tabHome")}
                    tone="gold"
                  />
                ) : (
                  <Text style={[RTL_TEXT, { color: "rgba(255,255,255,0.75)", fontSize: 12.5 }]}>
                    {t("menuEditProfile")}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            {/* Pro-mode switch — replaces the old top-bar toggle. Shown only to
                accounts that ARE professionals; the "join as a professional"
                row that used to sit in the else branch is gone, since providers
                now register on their own track from the login screen. */}
            {isPro ? (
              <MenuRow
                icon={mode === "pro" ? "person-outline" : "briefcase-outline"}
                label={mode === "pro" ? t("menuSwitchToCustomer") : t("menuSwitchToPro")}
                tint={colors.brand}
                onPress={() => {
                  setMode(mode === "pro" ? "customer" : "pro");
                  onClose();
                  router.replace(mode === "pro" ? "/(tabs)" : "/(tabs)/dashboard");
                }}
              />
            ) : null}

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />

            <MenuRow icon="clipboard-outline" label={t("menuMyBookings")} onPress={() => go("/(tabs)/bookings")} />
            <MenuRow icon="notifications-outline" label={t("menuNotifications")} onPress={() => go("/notifications")} />
            {isPro && professional ? (
              <MenuRow icon="settings-outline" label={t("menuProSettings")} onPress={() => go("/pro-settings")} />
            ) : null}

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />

            {/* language quick toggle */}
            <View style={{ ...ROW, gap: spacing.md, paddingVertical: 13 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.md,
                  backgroundColor: colors.chip,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="language-outline" size={19} color={colors.muted} />
              </View>
              <View style={{ flexDirection: "row-reverse", gap: spacing.sm, flex: 1 }}>
                {(["ar", "he"] as Lang[]).map((l) => (
                  <Pressable
                    key={l}
                    onPress={() => setLang(l)}
                    style={{
                      backgroundColor: lang === l ? colors.brand : colors.chip,
                      borderRadius: radius.full,
                      paddingHorizontal: 16,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ color: lang === l ? colors.onBrand : colors.text, fontSize: 13, fontWeight: "700" }}>
                      {LANG_NAMES[l]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* appearance quick toggle */}
            <View style={{ ...ROW, gap: spacing.md, paddingVertical: 13 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.md,
                  backgroundColor: colors.chip,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={dark ? "moon-outline" : "sunny-outline"} size={19} color={colors.muted} />
              </View>
              <View style={{ flexDirection: "row-reverse", gap: spacing.sm, flex: 1 }}>
                {themeOptions.map((opt) => (
                  <Pressable
                    key={opt.key}
                    onPress={() => setThemeMode(opt.key)}
                    style={{
                      backgroundColor: themeMode === opt.key ? colors.brand : colors.chip,
                      borderRadius: radius.full,
                      width: 40,
                      height: 32,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={themeMode === opt.key ? colors.onBrand : colors.muted}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />

            <MenuRow
              icon="logo-whatsapp"
              label={t("menuSupport")}
              onPress={() => {
                onClose();
                Linking.openURL(SUPPORT_WHATSAPP_URL).catch(() => {});
              }}
            />
            <MenuRow icon="document-text-outline" label={t("legalTitle")} onPress={() => go("/legal")} />

            <Text
              style={{
                color: colors.faint,
                fontSize: 11.5,
                textAlign: "center",
                marginTop: spacing.lg,
                writingDirection: "ltr",
              }}
            >
              DalConnect v{Constants.expoConfig?.version ?? "1.0.0"}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
