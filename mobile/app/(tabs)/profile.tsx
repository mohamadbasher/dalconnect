// Profile tab — account hero, become-pro promo, settings menu, sign out, delete account.
import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n, LANG_NAMES } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Avatar, Badge, Button, Card, Chip, Loading, SectionHeader } from "../../components/ui";
import type { Lang } from "../../lib/types";

function MenuRow({
  icon,
  label,
  onPress,
  danger,
  children,
  hideChevron,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  children?: React.ReactNode;
  hideChevron?: boolean;
}) {
  const { colors } = useTheme();
  const fg = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        ...ROW,
        gap: spacing.md,
        paddingVertical: 14,
        paddingHorizontal: spacing.lg,
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: danger ? colors.dangerTint : colors.brandTint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.brand} />
      </View>
      <Text style={[RTL_TEXT, { flex: 1, color: fg, fontSize: 15, fontWeight: "600" }]}>{label}</Text>
      {children}
      {onPress && !hideChevron ? <Ionicons name="chevron-back" size={18} color={colors.faint} /> : null}
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg }} />;
}

export default function ProfileScreen() {
  const { colors, shadows, mode: themeMode, setMode: setThemeMode } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { profile, professional, isPro, mode, setMode, signOut, loading } = useAuth();
  const router = useRouter();
  const [aboutVisible, setAboutVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading || !profile) return <Loading />;

  const verified = isPro && professional?.verification_status === "approved";
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const confirmSignOut = () => {
    Alert.alert(t("profileSignOut"), t("profileSignOutConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("profileSignOut"),
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/welcome");
        },
      },
    ]);
  };

  // ---- delete account (store requirement): two explicit confirms, then RPC ----
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

  const confirmDeleteAccount = () => {
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

  const themeChips: { key: "light" | "dark" | "system"; label: string }[] = [
    { key: "light", label: t("lightMode") },
    { key: "dark", label: t("darkMode") },
    { key: "system", label: t("systemMode") },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
    >
      {/* ---------- hero ---------- */}
      <Card>
        <View style={{ ...ROW, gap: spacing.lg }}>
          <Pressable onPress={() => router.push("/edit-profile")} hitSlop={6}>
            {/* brandTint ring makes the avatar feel premium */}
            <View
              style={{
                padding: 3,
                borderRadius: radius.full,
                borderWidth: 3,
                borderColor: colors.brandTint,
              }}
            >
              <Avatar uri={profile.avatar_url} name={profile.full_name} size={68} />
            </View>
            {/* edit pencil badge */}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: colors.brand,
                borderWidth: 2.5,
                borderColor: colors.card,
                alignItems: "center",
                justifyContent: "center",
                ...shadows.card,
              }}
            >
              <Ionicons name="pencil" size={12} color={colors.onBrand} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 18, fontWeight: "800" }]} numberOfLines={1}>
              {profile.full_name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "right", writingDirection: "ltr" }}>
              {"‎" + profile.phone}
            </Text>
            <View style={{ ...ROW, gap: 6 }}>
              <Badge label={t(isPro ? "profileRolePro" : "profileRoleCustomer")} tone={isPro ? "brand" : "neutral"} />
              {verified ? (
                <View style={{ ...ROW, gap: 3 }}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.info} />
                  <Text style={{ color: colors.info, fontSize: 12, fontWeight: "700" }}>{t("verified")}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Card>

      {/* ---------- become a pro (customers only) ---------- */}
      {!isPro ? (
        <Card style={{ backgroundColor: colors.brandTint, gap: spacing.md }}>
          <View style={{ ...ROW, gap: spacing.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                backgroundColor: colors.brand,
                alignItems: "center",
                justifyContent: "center",
                ...shadows.cta,
              }}
            >
              <Ionicons name="briefcase" size={23} color={colors.onBrand} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800" }]}>
                {t("profileBecomeProTitle")}
              </Text>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>{t("profileBecomeProSubtitle")}</Text>
            </View>
          </View>
          <Button title={t("profileBecomeProCta")} onPress={() => router.push("/become-pro")} />
        </Card>
      ) : null}

      {/* ---------- account ---------- */}
      <View>
        <SectionHeader title={t("profileSectionAccount")} />
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, ...shadows.card }}>
        <MenuRow icon="create-outline" label={t("profileEditProfile")} onPress={() => router.push("/edit-profile")} />
        <Divider />
        <MenuRow
          icon="notifications-outline"
          label={t("notifications")}
          onPress={() => router.push("/notifications")}
        />
        {isPro ? (
          <>
            <Divider />
            <MenuRow
              icon="briefcase-outline"
              label={t("profileBusinessSettings")}
              onPress={() => router.push("/pro-settings")}
            />
            <Divider />
            <MenuRow
              icon={mode === "pro" ? "person-outline" : "flash-outline"}
              label={t(mode === "pro" ? "profileSwitchToCustomer" : "profileSwitchToPro")}
              onPress={() => setMode(mode === "pro" ? "customer" : "pro")}
              hideChevron
            >
              <Ionicons name="swap-horizontal" size={18} color={colors.brand} />
            </MenuRow>
          </>
        ) : null}
        </View>
      </View>

      {/* ---------- preferences ---------- */}
      <View>
        <SectionHeader title={t("profileSectionPreferences")} />
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, ...shadows.card }}>
        <MenuRow icon="language-outline" label={t("language")}>
          <View style={{ ...ROW, gap: 6 }}>
            {(["ar", "he"] as Lang[]).map((l) => (
              <Chip key={l} label={LANG_NAMES[l]} active={lang === l} onPress={() => setLang(l)} />
            ))}
          </View>
        </MenuRow>
        <Divider />
        <MenuRow icon="moon-outline" label={t("profileAppearance")} />
        <View style={{ ...ROW, gap: 8, paddingHorizontal: spacing.lg, paddingBottom: 14, flexWrap: "wrap" }}>
          {themeChips.map((c) => (
            <Chip key={c.key} label={c.label} active={themeMode === c.key} onPress={() => setThemeMode(c.key)} />
          ))}
        </View>
        <Divider />
        <MenuRow
          icon="information-circle-outline"
          label={t("profileAboutLegal")}
          onPress={() => setAboutVisible(true)}
        />
        </View>
      </View>

      {/* ---------- sign out + delete account ---------- */}
      <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, ...shadows.card }}>
        <MenuRow icon="log-out-outline" label={t("profileSignOut")} onPress={confirmSignOut} danger hideChevron />
        <Divider />
        <MenuRow
          icon="trash-outline"
          label={t("profileDeleteAccount")}
          onPress={deleting ? undefined : confirmDeleteAccount}
          danger
          hideChevron
        >
          {deleting ? <ActivityIndicator size="small" color={colors.danger} /> : null}
        </MenuRow>
      </View>

      <Text style={{ color: colors.faint, fontSize: 12, textAlign: "center" }}>
        {t("profileVersion", { version })}
      </Text>

      {/* ---------- about / legal modal ---------- */}
      <Modal visible={aboutVisible} transparent animationType="fade" onRequestClose={() => setAboutVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: spacing.xl }}
          onPress={() => setAboutVisible(false)}
        >
          <Pressable onPress={() => {}}>
            <Card style={{ gap: spacing.md }}>
              <View style={{ ...ROW, justifyContent: "space-between" }}>
                <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>
                  {t("profileAboutLegal")}
                </Text>
                <Pressable onPress={() => setAboutVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
              </View>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 21 }]}>
                {t("profileAboutText")}
              </Text>
              <Text style={{ color: colors.faint, fontSize: 12, textAlign: "center" }}>
                {t("appName")} · {t("profileVersion", { version })}
              </Text>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
