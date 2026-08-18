// What a provider sees before an admin has approved them.
//
// The database refuses to show them open work, accept their quotes, or notify
// them (migration 20260714000017). Without this screen that refusal would
// simply look like an empty dashboard and a broken app — so it says what is
// happening, and what will make it stop.
//
// Rejected is its own state rather than a variant of pending: telling someone
// they're "waiting" when the answer already came is worse than telling them no.
import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button } from "./ui";
import type { VerificationStatus } from "../lib/types";

const SUPPORT_WHATSAPP_URL = "https://wa.me/972500000000"; // TODO(owner): real support number

export function ProApprovalGate({ status }: { status: VerificationStatus }) {
  const { colors, shadows } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const rejected = status === "rejected";

  const tint = rejected ? colors.dangerTint : colors.warnTint;
  const fg = rejected ? colors.danger : colors.warn;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        padding: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: spacing.xl,
          gap: spacing.md,
          alignItems: "center",
          ...shadows.card,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            backgroundColor: tint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={rejected ? "close-circle-outline" : "hourglass-outline"} size={34} color={fg} />
        </View>

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" }}>
          {t(rejected ? "proPendingRejectedTitle" : "proPendingTitle")}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 21, textAlign: "center" }}>
          {t(rejected ? "proPendingRejectedBody" : "proPendingBody")}
        </Text>

        {/* Waiting is easier when there's something useful to do meanwhile —
            and a complete profile is exactly what the reviewer is looking at. */}
        {!rejected ? (
          <View
            style={{
              backgroundColor: colors.bg,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: 6,
              alignSelf: "stretch",
            }}
          >
            <View style={{ ...ROW, alignItems: "center", gap: 6 }}>
              <Ionicons name="bulb-outline" size={15} color={colors.brand} />
              <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 13, fontWeight: "800" }]}>
                {t("proPendingMeanwhileTitle")}
              </Text>
            </View>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, lineHeight: 18 }]}>
              {t("proPendingMeanwhileBody")}
            </Text>
          </View>
        ) : null}

        <View style={{ alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.xs }}>
          <Button
            title={t("proPendingCompleteProfile")}
            icon="briefcase-outline"
            onPress={() => router.push("/pro-settings")}
          />
          <Pressable
            onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL).catch(() => {})}
            hitSlop={8}
            style={({ pressed }) => ({
              ...ROW,
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
              paddingVertical: 10,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "700" }}>{t("helpContact")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
