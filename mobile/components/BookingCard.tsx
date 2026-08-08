// Booking card — one clean row, used by the customer bookings tab and the pro
// jobs tab. Two lines only: identity on top (icon · title · counterpart · status)
// and a meta line underneath (urgency · time · money), so a long title never has
// to fight the badges for room.
import React from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing, formatPrice } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { formatTime, STATUS_KEY, STATUS_TONE } from "../lib/format";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Badge } from "./ui";
import { MONEY_TEXT } from "./OfferCard";
import type { Booking, BookingStatus } from "../lib/types";

type MCIName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Urgency only means something while the job is still ahead of you. */
const URGENCY_RELEVANT: BookingStatus[] = ["open", "pending", "accepted", "on_the_way", "in_progress"];

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
  const showUrgency = URGENCY_RELEVANT.includes(booking.status);
  const title = booking.category ? loc(booking.category, "name") : booking.title || t("category");
  // Until somebody is attached there is no name to show, so the job's own words
  // stand in — an open request with a blank second line reads as broken.
  const subtitle = otherName || booking.description || "";

  return (
    <Pressable
      onPress={() => router.push((href ?? `/booking/${booking.id}`) as never)}
      style={({ pressed }) => [
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: 10,
          ...shadows.card,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={{ ...ROW, gap: 10 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: radius.md,
            backgroundColor: colors.brandTint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name={(booking.category?.icon as MCIName) ?? "tools"}
            size={21}
            color={colors.brand}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800" }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5 }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Badge label={t(STATUS_KEY[booking.status])} tone={STATUS_TONE[booking.status]} />
      </View>

      <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
        <View style={{ ...ROW, gap: 8, flexShrink: 1 }}>
          {showUrgency ? (
            <View
              style={{
                ...ROW,
                gap: 4,
                backgroundColor: isUrgent ? colors.warnTint : colors.chip,
                borderRadius: radius.full,
                paddingHorizontal: 9,
                paddingVertical: 3,
              }}
            >
              <MaterialCommunityIcons
                name={isUrgent ? "flash" : "calendar-clock"}
                size={11}
                color={isUrgent ? colors.warn : colors.muted}
              />
              <Text style={{ color: isUrgent ? colors.warn : colors.muted, fontSize: 11, fontWeight: "700" }}>
                {t(isUrgent ? "urgencyUrgentTag" : "urgencyScheduledTag")}
              </Text>
            </View>
          ) : null}
          <View style={{ ...ROW, gap: 4 }}>
            <Ionicons name="time-outline" size={12} color={colors.faint} />
            <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>
              {formatTime(booking.created_at, lang)}
            </Text>
          </View>
        </View>
        {moneyText ? (
          <Text style={[MONEY_TEXT, { color: colors.brand, fontSize: 15, fontWeight: "800" }]}>{moneyText}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
