// Help centre — the questions people actually ask about THIS product.
//
// Written from how the app really behaves rather than generic filler: when the
// phone number appears, why quotes are ranges, who sets the final price, what
// the request fee is. If an answer here ever stops matching the app, the answer
// is wrong, not the app.
import React, { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { useToast } from "../components/Toast";

/** TODO(owner): real support channels before launch. */
const SUPPORT = {
  whatsapp: "972500000000",
  email: "support@dalconnect.app",
};

const FAQ_KEYS = ["faqPhone", "faqRange", "faqFee", "faqCancel", "faqNoOffers", "faqRating"] as const;

export default function HelpScreen() {
  const { colors, shadows } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);

  const openUrl = async (url: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error("no handler");
      await Linking.openURL(url);
    } catch {
      toast.error(t("helpContactFailed"));
    }
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
          {t("helpTitle")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, lineHeight: 19 }]}>{t("helpSubtitle")}</Text>

        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, ...shadows.card }}>
          {FAQ_KEYS.map((k, i) => {
            const isOpen = open === k;
            return (
              <View key={k}>
                {i > 0 ? <View style={{ height: 1, backgroundColor: colors.hairline, marginHorizontal: spacing.lg }} /> : null}
                <Pressable
                  onPress={() => setOpen(isOpen ? null : k)}
                  style={({ pressed }) => ({ padding: spacing.lg, gap: 8, opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{ ...ROW, alignItems: "center", gap: spacing.sm }}>
                    <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: "700" }]}>
                      {t(`${k}Q`)}
                    </Text>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.faint} />
                  </View>
                  {isOpen ? (
                    <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, lineHeight: 20 }]}>
                      {t(`${k}A`)}
                    </Text>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: spacing.sm }]}>
          {t("helpStillNeed")}
        </Text>

        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => openUrl(`whatsapp://send?phone=${SUPPORT.whatsapp}`)}
            style={({ pressed }) => [
              {
                ...ROW,
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                padding: spacing.md,
                ...shadows.card,
              },
              pressed ? { opacity: 0.75 } : null,
            ]}
          >
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: "700" }]}>
              {t("helpWhatsapp")}
            </Text>
            <Ionicons name="chevron-back" size={16} color={colors.faint} />
          </Pressable>

          <Pressable
            onPress={() => openUrl(`mailto:${SUPPORT.email}`)}
            style={({ pressed }) => [
              {
                ...ROW,
                alignItems: "center",
                gap: spacing.md,
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                padding: spacing.md,
                ...shadows.card,
              },
              pressed ? { opacity: 0.75 } : null,
            ]}
          >
            <Ionicons name="mail-outline" size={22} color={colors.brand} />
            <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: "700" }]}>
              {t("helpEmail")}
            </Text>
            <Ionicons name="chevron-back" size={16} color={colors.faint} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
