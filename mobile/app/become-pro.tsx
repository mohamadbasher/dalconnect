// Explains that a professional account is its own account.
//
// A customer account can no longer be "upgraded" — providers register on the
// provider track so that one person can hold both, on the same phone number,
// each with its own login. This screen is what every "join as a professional"
// entry point leads to.
import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "../lib/i18n";
import { useTheme, radius, spacing } from "../lib/theme";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button } from "../components/ui";
import { useAuth } from "../context/AuthContext";

function Point({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ ...ROW, gap: spacing.md, alignItems: "flex-start" }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          backgroundColor: colors.brandTint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={icon} size={19} color={colors.brand} />
      </View>
      <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 8 }]}>
        {text}
      </Text>
    </View>
  );
}

export default function BecomeProInfo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { colors, shadows } = useTheme();
  const { signOut } = useAuth();

  const goRegister = () => {
    Alert.alert(t("provSwitchTitle"), t("provSwitchBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("provSwitchConfirm"),
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/register-provider");
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ ...ROW, gap: spacing.md, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
            ...shadows.card,
          }}
        >
          <Ionicons name="arrow-forward" size={20} color={colors.text} />
        </Pressable>
        <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
          {t("proGateTitle")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.lg,
            ...shadows.card,
          }}
        >
          <Text style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800" }]}>
            {t("provSeparateTitle")}
          </Text>
          <Point icon="account-multiple-outline" text={t("provSeparatePoint1")} />
          <Point icon="pound" text={t("provSeparatePoint2")} />
          <Point icon="bell-ring-outline" text={t("provSeparatePoint3")} />
        </View>

        <Button title={t("provRegEntry")} icon="hammer-wrench" onPress={goRegister} />
      </ScrollView>
    </View>
  );
}
