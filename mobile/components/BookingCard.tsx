// Booking card — used by the customer bookings tab and the pro jobs tab.
import React from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing, formatPrice } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { formatTime, STATUS_KEY, STATUS_TONE } from "../lib/format";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Badge } from "./ui";
import type { Booking } from "../lib/types";

export function BookingCard({
  booking,
  /** 'customer' shows the pro name; 'pro' shows the customer name */
  perspective = "customer",
  href,
}: {
  booking: Booking;
  perspective?: "customer" | "pro";
  href?: string;
}) {
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const router = useRouter();

  const otherName =
    perspective === "customer"
      ? booking.professional?.business_name || booking.professional?.profile?.full_name
      : booking.customer?.full_name;

  return (
    <Pressable
      onPress={() => router.push((href ?? `/booking/${booking.id}`) as any)}
      style={({ pressed }) => [
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: 8,
          ...shadows.card,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
        <View style={{ ...ROW, gap: 8, flexShrink: 1 }}>
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
            <MaterialCommunityIcons
              name={(booking.category?.icon as any) ?? "tools"}
              size={20}
              color={colors.brand}
            />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 14.5, fontWeight: "800" }]}>
              {booking.category ? loc(booking.category, "name") : booking.title || t("category")}
            </Text>
            {otherName ? (
              <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>
                {otherName}
              </Text>
            ) : null}
          </View>
        </View>
        <Badge label={t(STATUS_KEY[booking.status])} tone={STATUS_TONE[booking.status]} />
      </View>

      {booking.description ? (
        <Text numberOfLines={2} style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>
          {booking.description}
        </Text>
      ) : null}

      <View style={{ ...ROW, justifyContent: "space-between" }}>
        <View style={{ ...ROW, gap: 4 }}>
          <Ionicons name="time-outline" size={13} color={colors.faint} />
          <Text style={{ color: colors.faint, fontSize: 12 }}>{formatTime(booking.created_at, lang)}</Text>
        </View>
        {booking.price != null ? (
          <Text style={{ color: colors.brand, fontSize: 15, fontWeight: "800" }}>{formatPrice(booking.price)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
