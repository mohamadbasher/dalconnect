// Professional card — used in home, search results and favorites.
import React from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Avatar, Badge } from "./ui";
import type { ProCard as ProCardType } from "../lib/types";

export function ProCard({ pro }: { pro: ProCardType }) {
  const { colors, shadows } = useTheme();
  const { t, loc } = useI18n();
  const router = useRouter();
  const name = pro.business_name || pro.profile?.full_name || "";

  return (
    <Pressable
      onPress={() => router.push(`/pro/${pro.id}`)}
      style={({ pressed }) => [
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: 10,
          ...shadows.card,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={{ ...ROW, gap: 12 }}>
        <Avatar uri={pro.profile?.avatar_url} name={name} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ ...ROW, gap: 6 }}>
            <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800", flexShrink: 1 }]}>
              {name}
            </Text>
            {pro.verification_status === "approved" ? (
              <MaterialCommunityIcons name="check-decagram" size={17} color={colors.info} />
            ) : null}
          </View>
          {pro.categories?.length ? (
            <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5 }]}>
              {pro.categories.map((c) => loc(c, "name")).join(" · ")}
            </Text>
          ) : null}
          <View style={{ ...ROW, gap: 10 }}>
            <View style={{ ...ROW, gap: 3 }}>
              <Ionicons name="star" size={13} color={colors.gold} />
              <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>
                {pro.rating_count > 0 ? Number(pro.rating_avg).toFixed(1) : "—"}
              </Text>
              {pro.rating_count > 0 ? (
                <Text style={{ color: colors.faint, fontSize: 11.5 }}>({pro.rating_count})</Text>
              ) : null}
            </View>
            {pro.city ? (
              <View style={{ ...ROW, gap: 3 }}>
                <Ionicons name="location-outline" size={13} color={colors.faint} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>{loc(pro.city, "name")}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Badge label={pro.is_available ? t("available") : t("unavailable")} tone={pro.is_available ? "success" : "neutral"} />
      </View>
    </Pressable>
  );
}
