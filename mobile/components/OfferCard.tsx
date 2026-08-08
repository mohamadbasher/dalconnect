// A single quote on a request — this card has one job: let the customer judge a
// professional they have never seen. Reading order (RTL, top to bottom):
// who they are → the price range → when they arrive → their note → accept.
// Accepting is the only loud action; declining is a quiet text link underneath.
import React from "react";
import { Pressable, Text, TextStyle, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing, formatPrice } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Avatar, Button } from "./ui";
import type { City, Offer, Professional, Profile } from "../lib/types";

/**
 * Money, ratings and phone numbers are Latin digits inside an RTL paragraph.
 * Without an explicit LTR run the bidi algorithm re-orders them — "₪250 – ₪400"
 * renders as "₪400 – ₪250". Every numeric Text in the request screens wears this.
 */
export const MONEY_TEXT: TextStyle = { writingDirection: "ltr", textAlign: "right" };

/** The professional shape the quote list selects (profile + city embedded). */
export type QuotePro = Professional & { profile?: Profile; city?: City | null };
/** An offer row with that richer professional attached. */
export type QuoteOffer = Omit<Offer, "professional"> & { professional?: QuotePro };

/**
 * Quotes are ranges now. `price` is the legacy single-value column and is used
 * only when both range fields are missing (rows created before the pivot).
 */
export function quotePriceText(
  min: number | string | null | undefined,
  max: number | string | null | undefined,
  legacy?: number | string | null
): string {
  const num = (v: number | string | null | undefined): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isNaN(n) ? null : n;
  };
  const lo = num(min) ?? num(max) ?? num(legacy);
  const hi = num(max) ?? num(min) ?? num(legacy);
  if (lo === null || hi === null) return "";
  if (lo === hi) return formatPrice(lo);
  // Rendered inside a MONEY_TEXT run so the two amounts keep their order.
  return `${formatPrice(lo)} – ${formatPrice(hi)}`;
}

/** Display name for a professional: business name first, then the person's. */
export function proDisplayName(pro?: QuotePro | null): string {
  if (!pro) return "";
  return pro.business_name || pro.profile?.full_name || "";
}

export function OfferCard({
  offer,
  onAccept,
  onDecline,
  busy,
  disabled,
}: {
  offer: QuoteOffer;
  onAccept: (offer: QuoteOffer) => void;
  onDecline: (offer: QuoteOffer) => void;
  /** this quote's own action is in flight */
  busy?: boolean;
  /** some other quote's action is in flight — lock this card too */
  disabled?: boolean;
}) {
  const { colors, shadows } = useTheme();
  const { t, loc } = useI18n();
  const router = useRouter();

  const pro = offer.professional;
  const name = proDisplayName(pro);
  const price = quotePriceText(offer.price_min, offer.price_max, offer.price);
  const ratingCount = pro?.rating_count ?? 0;
  const locked = Boolean(busy || disabled);

  // jobs done · city — one muted line, no icons, so the star stays the only mark
  const facts = [
    pro && pro.jobs_completed > 0 ? t("quoteJobsDone", { n: pro.jobs_completed }) : null,
    pro?.city ? loc(pro.city, "name") : null,
  ].filter(Boolean) as string[];

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
        ...shadows.card,
      }}
    >
      {/* who is quoting — the whole row opens their profile */}
      <Pressable
        onPress={() => router.push(`/pro/${offer.professional_id}` as never)}
        style={({ pressed }) => ({ ...ROW, gap: 12, opacity: pressed ? 0.7 : 1 })}
      >
        <Avatar uri={pro?.profile?.avatar_url} name={name} size={46} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ ...ROW, gap: 5 }}>
            <Text
              numberOfLines={1}
              style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800", flexShrink: 1 }]}
            >
              {name || t("quoteUnknownPro")}
            </Text>
            {pro?.verification_status === "approved" ? (
              <MaterialCommunityIcons name="check-decagram" size={15} color={colors.info} />
            ) : null}
          </View>

          {/* trust signals, compact: ★ 4.8 (12) · 34 عمل منجز · الناصرة */}
          <View style={{ ...ROW, gap: 6 }}>
            <Ionicons name="star" size={12} color={colors.gold} />
            <Text style={[MONEY_TEXT, { color: colors.text, fontSize: 12, fontWeight: "700" }]}>
              {ratingCount > 0 ? `${Number(pro?.rating_avg ?? 0).toFixed(1)} (${ratingCount})` : ""}
            </Text>
            {ratingCount === 0 ? (
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>{t("quoteNoRatingYet")}</Text>
            ) : null}
            {facts.length > 0 ? (
              <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12, flexShrink: 1 }]}>
                {`· ${facts.join(" · ")}`}
              </Text>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-back" size={16} color={colors.faint} />
      </Pressable>

      {/* the money — the reason this card exists */}
      <View
        style={{
          backgroundColor: colors.brandTint,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          ...ROW,
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Text style={[RTL_TEXT, { color: colors.brandDark, fontSize: 11.5, fontWeight: "700" }]}>
            {t("quotePriceLabel")}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[
              price ? MONEY_TEXT : RTL_TEXT,
              { color: colors.brand, fontSize: 24, fontWeight: "800" },
            ]}
          >
            {price || t("quoteNoPrice")}
          </Text>
        </View>
        {offer.eta_minutes != null ? (
          <View
            style={{
              ...ROW,
              gap: 5,
              backgroundColor: colors.card,
              borderRadius: radius.full,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <MaterialCommunityIcons name="clock-fast" size={14} color={colors.info} />
            <Text style={{ color: colors.info, fontSize: 12, fontWeight: "700" }}>
              {t("quoteEta", { n: offer.eta_minutes })}
            </Text>
          </View>
        ) : null}
      </View>

      {offer.message ? (
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 20 }]}>{offer.message}</Text>
      ) : null}

      {/* one loud action; declining is deliberately quiet */}
      <Button
        title={t("quoteAccept")}
        icon="check"
        loading={busy}
        disabled={locked}
        onPress={() => onAccept(offer)}
      />
      <Pressable
        onPress={() => onDecline(offer)}
        disabled={locked}
        hitSlop={8}
        style={({ pressed }) => ({
          alignItems: "center",
          paddingVertical: 2,
          opacity: locked ? 0.4 : pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{t("quoteDecline")}</Text>
      </Pressable>
    </View>
  );
}
