// Profile tab — brand hero, become-pro promo, quiet grouped rows, sign out, delete account.
import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextStyle, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n, LANG_NAMES } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Avatar, Button, Card, Loading, SectionHeader } from "../../components/ui";
import type { Lang } from "../../lib/types";

/** Phone numbers are Latin digits — pin them LTR inside the RTL layout. */
const LTR: TextStyle = { writingDirection: "ltr", textAlign: "right" };

/** A quiet settings row: icon disc, label, optional trailing control, chevron. */
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
        paddingVertical: 13,
        paddingHorizontal: spacing.lg,
        opacity: pressed && onPress ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.md,
          backgroundColor: danger ? colors.dangerTint : colors.brandTint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={17} color={danger ? colors.danger : colors.brand} />
      </View>
      <Text style={[RTL_TEXT, { flex: 1, color: fg, fontSize: 15, fontWeight: "600" }]}>{label}</Text>
      {children}
      {/* RTL: "back" points right, which is forward in this layout */}
      {onPress && !hideChevron ? <Ionicons name="chevron-back" size={17} color={colors.faint} /> : null}
    </Pressable>
  );
}

/** Hairline between rows, inset past the icon disc so it starts under the label. */
function Divider() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.hairline,
        marginRight: spacing.lg + 34 + spacing.md,
        marginLeft: spacing.lg,
      }}
    />
  );
}

/** Compact segmented pill — the calm way to show a two/three-way choice in a row. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label?: string; icon?: keyof typeof Ionicons.glyphMap; a11y?: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={{
        ...ROW,
        gap: 2,
        backgroundColor: colors.chip,
        borderRadius: radius.full,
        padding: 3,
      }}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityLabel={o.a11y ?? o.label}
            accessibilityState={{ selected: on }}
            style={{
              ...ROW,
              gap: 5,
              paddingHorizontal: o.label ? 12 : 10,
              paddingVertical: 6,
              borderRadius: radius.full,
              backgroundColor: on ? colors.card : "transparent",
              ...(on ? shadows.card : null),
            }}
          >
            {o.icon ? (
              <Ionicons name={o.icon} size={15} color={on ? colors.brand : colors.muted} />
            ) : null}
            {o.label ? (
              <Text style={{ color: on ? colors.brand : colors.muted, fontSize: 12.5, fontWeight: "700" }}>
                {o.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
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

  const group: (children: React.ReactNode) => React.ReactNode = (children) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        paddingVertical: spacing.xs,
        ...shadows.card,
      }}
    >
      {children}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------- brand hero ---------- */}
      <View
        style={{
          backgroundColor: colors.brand,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.lg,
          overflow: "hidden",
        }}
      >
        {/* soft decorative discs (brand surface, so they're drawn in onBrand) */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -70,
            left: -40,
            width: 170,
            height: 170,
            borderRadius: radius.full,
            backgroundColor: colors.onBrand,
            opacity: 0.1,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: -55,
            left: 60,
            width: 110,
            height: 110,
            borderRadius: radius.full,
            backgroundColor: colors.onBrand,
            opacity: 0.08,
          }}
        />

        <View style={{ ...ROW, gap: spacing.md }}>
          <Pressable onPress={() => router.push("/edit-profile")} hitSlop={6}>
            <View
              style={{
                padding: 3,
                borderRadius: radius.full,
                borderWidth: 2,
                borderColor: colors.onBrand,
              }}
            >
              <Avatar uri={profile.avatar_url} name={profile.full_name} size={64} />
            </View>
          </Pressable>

          <View style={{ flex: 1, gap: 4 }}>
            <Text
              numberOfLines={1}
              style={[RTL_TEXT, { color: colors.onBrand, fontSize: 20, fontWeight: "800" }]}
            >
              {profile.full_name}
            </Text>
            <Text style={[LTR, { color: colors.onBrand, opacity: 0.85, fontSize: 13.5 }]}>
              {"‎" + profile.phone}
            </Text>
            <View style={{ ...ROW, gap: 6, marginTop: 2 }}>
              <View
                style={{
                  ...ROW,
                  gap: 4,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: colors.onBrand,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Ionicons name={isPro ? "briefcase" : "person"} size={11} color={colors.onBrand} />
                <Text style={{ color: colors.onBrand, fontSize: 11.5, fontWeight: "700" }}>
                  {t(isPro ? "profileRolePro" : "profileRoleCustomer")}
                </Text>
              </View>
              {verified ? (
                <View style={{ ...ROW, gap: 3 }}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.onBrand} />
                  <Text style={{ color: colors.onBrand, fontSize: 11.5, fontWeight: "700" }}>
                    {t("verified")}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/edit-profile")}
          style={({ pressed }) => ({
            ...ROW,
            // RTL: hug the start edge, which is the right one
            alignSelf: "flex-end",
            gap: 6,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: colors.onBrand,
            paddingHorizontal: 16,
            paddingVertical: 8,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Ionicons name="create-outline" size={15} color={colors.onBrand} />
          <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>
            {t("profileEditProfile")}
          </Text>
        </Pressable>
      </View>

      {/* ---------- become a pro (customers only) ---------- */}
      {!isPro ? (
        <Card style={{ backgroundColor: colors.brandTint, gap: spacing.md }}>
          <View style={{ ...ROW, gap: spacing.md }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.md,
                backgroundColor: colors.brand,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="briefcase" size={22} color={colors.onBrand} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
                {t("profileBecomeProTitle")}
              </Text>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, lineHeight: 19 }]}>
                {t("profileBecomeProSubtitle")}
              </Text>
            </View>
          </View>
          <Button title={t("profileBecomeProCta")} onPress={() => router.push("/become-pro")} />
        </Card>
      ) : null}

      {/* ---------- account ---------- */}
      <View>
        <SectionHeader title={t("profileSectionAccount")} />
        {group(
          <>
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
          </>
        )}
      </View>

      {/* ---------- preferences ---------- */}
      <View>
        <SectionHeader title={t("profileSectionPreferences")} />
        {group(
          <>
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
            <Divider />
            <MenuRow
              icon="information-circle-outline"
              label={t("profileAboutLegal")}
              onPress={() => setAboutVisible(true)}
            />
          </>
        )}
      </View>

      {/* ---------- sign out + delete account ---------- */}
      {group(
        <>
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
        </>
      )}

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
