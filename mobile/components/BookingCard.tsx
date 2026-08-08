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

  // Money shown, in order of truth: what was actually charged, then the accepted
  // quote range, then the legacy single price on pre-quote-model rows.
  const num = (v: number | string | null | undefined): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isNaN(n) ? null : n;
  };
  const finalPrice = num(booking.final_price);
  const min = num(booking.price_min);
  const max = num(booking.price_max);
  const legacy = num(booking.price);
  const moneyText =
    finalPrice != null
      ? formatPrice(finalPrice)
      : min != null && max != null
        ? min === max
          ? formatPrice(min)
          : `${formatPrice(min)} – ${formatPrice(max)}`
        : legacy != null
          ? formatPrice(legacy)
          : "";

  const isUrgent = booking.urgency === "same_day";

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
        <View style={{ alignItems: "flex-start", gap: 4 }}>
          <Badge label={t(STATUS_KEY[booking.status])} tone={STATUS_TONE[booking.status]} />
          {/* how soon it was asked for — urgent jobs have to be spottable at a glance */}
          <View
            style={{
              ...ROW,
              gap: 5,
              backgroundColor: isUrgent ? colors.warnTint : colors.chip,
              borderRadius: radius.full,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <MaterialCommunityIcons
              name={isUrgent ? "flash" : "calendar-clock"}
              size={12}
              color={isUrgent ? colors.warn : colors.muted}
            />
            <Text style={{ color: isUrgent ? colors.warn : colors.muted, fontSize: 11, fontWeight: "700" }}>
              {t(isUrgent ? "urgencyUrgentTag" : "urgencyScheduledTag")}
            </Text>
          </View>
        </View>
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
        {moneyText ? (
          <Text style={{ color: colors.brand, fontSize: 15, fontWeight: "800" }}>{moneyText}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
