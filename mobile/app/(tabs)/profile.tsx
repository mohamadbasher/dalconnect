// Profile tab — an account centre, not a settings list: who you are, then
// grouped sections for account, preferences, help, and finally sign out.
// Deleting an account lives behind /account-settings; notifications are not
// here at all, since the top-bar bell is on every screen already.
import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextStyle, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n, LANG_NAMES } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
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

  // Deleting an account now lives in /account-settings — see the comment by the
  // sign-out row below.

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

        {/* A provider signs in with this number, not their phone — so it has to
            be somewhere they can always find it. */}
        {profile.provider_no ? (
          <View
            style={{
              ...ROW,
              justifyContent: "space-between",
              gap: spacing.md,
              backgroundColor: "rgba(255,255,255,0.16)",
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
              marginTop: spacing.md,
            }}
          >
            <Text style={[RTL_TEXT, { color: colors.onBrand, fontSize: 12.5, fontWeight: "700", flex: 1 }]}>
              {t("provSuccessNoLabel")}
            </Text>
            <Text
              style={{
                color: colors.onBrand,
                fontSize: 19,
                fontWeight: "900",
                letterSpacing: 3,
                writingDirection: "ltr",
              }}
            >
              {profile.provider_no}
            </Text>
          </View>
        ) : null}

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

      {/* ---------- my account ----------
           Notifications is deliberately NOT here: the bell in the top bar is on
           every screen, so a second entry point only pads the list. */}
      <View>
        <SectionHeader title={t("profileSectionAccount")} />
        {group(
          <>
            <MenuRow
              icon="person-outline"
              label={t("profilePersonalDetails")}
              onPress={() => router.push("/edit-profile")}
            />
            <Divider />
            <MenuRow
              icon="location-outline"
              label={t("profileSavedAddresses")}
              onPress={() => router.push("/saved-addresses")}
            />
            <Divider />
            <MenuRow
              icon="settings-outline"
              label={t("profileSettings")}
              onPress={() => router.push("/account-settings")}
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
          </>
        )}
      </View>

      {/* ---------- help & support ----------
           "Report a problem" here is about the APP or the account. A complaint
           about a specific job has its own route from that booking, where it
           arrives attached to the booking and the professional. */}
      <View>
        <SectionHeader title={t("profileSectionHelp")} />
        {group(
          <>
            <MenuRow icon="help-circle-outline" label={t("helpCenter")} onPress={() => router.push("/help")} />
            <Divider />
            <MenuRow
              icon="chatbubble-ellipses-outline"
              label={t("helpContact")}
              onPress={() => router.push("/help")}
            />
            <Divider />
            <MenuRow
              icon="alert-circle-outline"
              label={t("helpReportProblem")}
              onPress={() => router.push("/report")}
            />
            <Divider />
            <MenuRow
              icon="information-circle-outline"
              label={t("profileAboutLegal")}
              onPress={() => setAboutVisible(true)}
            />
          </>
        )}
      </View>

      {/* ---------- sign out ----------
           Deleting an account moved to /account-settings: everything else on
           this page is reversible, and an irreversible action does not belong
           one tap away from "appearance". */}
      {group(
        <MenuRow icon="log-out-outline" label={t("profileSignOut")} onPress={confirmSignOut} danger hideChevron />
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
