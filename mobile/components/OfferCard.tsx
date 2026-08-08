// A single quote on a request — this card has one job: let the customer judge a
// professional they have never seen. So it leads with who the pro is (avatar,
// rating, jobs done, verified mark) and shows the money as a big, unmissable
// range, then gets out of the way with three clear actions.
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing, formatPrice } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Avatar, Button } from "./ui";
import type { City, Offer, Professional, Profile } from "../lib/types";

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
  // The dash keeps the pair as one bidi-neutral run, so it reads correctly in
  // both RTL languages without any explicit direction marks.
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
      {/* who is quoting */}
      <View style={{ ...ROW, gap: 12, alignItems: "flex-start" }}>
        <Avatar uri={pro?.profile?.avatar_url} name={name} size={48} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ ...ROW, gap: 5 }}>
            <Text
              numberOfLines={1}
              style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800", flexShrink: 1 }]}
            >
              {name || t("quoteUnknownPro")}
            </Text>
            {pro?.verification_status === "approved" ? (
              <MaterialCommunityIcons name="check-decagram" size={16} color={colors.info} />
            ) : null}
          </View>

          {/* trust row: rating · jobs done · city */}
          <View style={{ ...ROW, gap: 10, flexWrap: "wrap" }}>
            <View style={{ ...ROW, gap: 3 }}>
              <Ionicons name="star" size={13} color={colors.gold} />
              <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>
                {ratingCount > 0 ? Number(pro?.rating_avg ?? 0).toFixed(1) : t("quoteNoRatingYet")}
              </Text>
              {ratingCount > 0 ? (
                <Text style={{ color: colors.faint, fontSize: 11.5 }}>
                  ({ratingCount})
                </Text>
              ) : null}
            </View>
            {pro && pro.jobs_completed > 0 ? (
              <View style={{ ...ROW, gap: 3 }}>
                <MaterialCommunityIcons name="briefcase-check-outline" size={13} color={colors.faint} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {t("quoteJobsDone", { n: pro.jobs_completed })}
                </Text>
              </View>
            ) : null}
            {pro?.city ? (
              <View style={{ ...ROW, gap: 3 }}>
                <Ionicons name="location-outline" size={13} color={colors.faint} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>{loc(pro.city, "name")}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* the money — the reason this card exists */}
      <View
        style={{
          backgroundColor: colors.brandTint,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          gap: 8,
        }}
      >
        <Text style={[RTL_TEXT, { color: colors.brandDark, fontSize: 11.5, fontWeight: "700" }]}>
          {t("quotePriceLabel")}
        </Text>
        <View style={{ ...ROW, justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ color: colors.brand, fontSize: 26, fontWeight: "800", flexShrink: 1 }}
          >
            {price || t("quoteNoPrice")}
          </Text>
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
      </View>

      {offer.message ? (
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 20 }]}>{offer.message}</Text>
      ) : null}

      {/* actions */}
      <View style={{ ...ROW, gap: 10 }}>
        <Button
          title={t("quoteAccept")}
          icon="check"
          small
          loading={busy}
          disabled={locked}
          style={{ flex: 1.4 }}
          onPress={() => onAccept(offer)}
        />
        <Button
          title={t("quoteDecline")}
          variant="outline"
          small
          disabled={locked}
          style={{ flex: 1 }}
          onPress={() => onDecline(offer)}
        />
      </View>

      <Pressable
        onPress={() => router.push(`/pro/${offer.professional_id}` as never)}
        hitSlop={8}
        style={({ pressed }) => ({
          ...ROW,
          gap: 4,
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "700" }}>{t("quoteViewProfile")}</Text>
        <Ionicons name="chevron-back" size={14} color={colors.brand} />
      </Pressable>
    </View>
  );
}
