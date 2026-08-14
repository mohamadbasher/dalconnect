// A single quote on a request — this card has one job: let the customer judge a
// professional they have never seen, and compare them against the next card
// down. Reading order (RTL, top to bottom): who they are → whether they're
// available → the price → when they arrive → their note → accept.
//
// The price block and the arrival line sit at the SAME height on every card,
// because comparing is the actual task. Anything that varies in position — a
// long note, a missing rating — is pushed below them or clamped.
import React, { useState } from "react";
import { Modal, Pressable, Text, TextStyle, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing, formatPrice } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Avatar, Button, SheetHandle } from "./ui";
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
  onChat,
  busy,
  disabled,
}: {
  offer: QuoteOffer;
  onAccept: (offer: QuoteOffer) => void;
  onDecline: (offer: QuoteOffer) => void;
  /** open a conversation with this professional, before any quote is accepted */
  onChat: (offer: QuoteOffer) => void;
  /** this quote's own action is in flight */
  busy?: boolean;
  /** some other quote's action is in flight — lock this card too */
  disabled?: boolean;
}) {
  const { colors, shadows } = useTheme();
  const { t, loc } = useI18n();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const pro = offer.professional;
  const name = proDisplayName(pro);
  const price = quotePriceText(offer.price_min, offer.price_max, offer.price);
  const ratingCount = pro?.rating_count ?? 0;
  const locked = Boolean(busy || disabled);
  const available = pro?.is_available === true;
  const openProfile = () => router.push(`/pro/${offer.professional_id}` as never);

  const menuRow = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    danger?: boolean
  ) => (
    <Pressable
      onPress={() => {
        setMenuOpen(false);
        onPress();
      }}
      style={({ pressed }) => ({
        ...ROW,
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: 14,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.text} />
      <Text style={[RTL_TEXT, { flex: 1, color: danger ? colors.danger : colors.text, fontSize: 15 }]}>
        {label}
      </Text>
    </Pressable>
  );

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
      {/* who is quoting. The avatar leads (right) like every other person-row in
          the app; the overflow sits at the far edge so it never competes. */}
      <View style={{ ...ROW, gap: 12, alignItems: "flex-start" }}>
        <Pressable
          onPress={openProfile}
          style={({ pressed }) => ({ ...ROW, gap: 12, flex: 1, opacity: pressed ? 0.7 : 1 })}
        >
          <Avatar uri={pro?.profile?.avatar_url} name={name} size={46} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ ...ROW, gap: 5, alignItems: "center" }}>
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

            {/* rating on its own line, jobs beneath — both in the same place on
                every card so the eye can run straight down the column */}
            <View style={{ ...ROW, gap: 5, alignItems: "center" }}>
              <Ionicons name="star" size={12} color={colors.gold} />
              {ratingCount > 0 ? (
                <Text style={[MONEY_TEXT, { color: colors.text, fontSize: 12.5, fontWeight: "700" }]}>
                  {Number(pro?.rating_avg ?? 0).toFixed(1)}
                </Text>
              ) : null}
              <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12, flexShrink: 1 }]}>
                {ratingCount > 0
                  ? `· ${t("quoteReviewsCount", { n: ratingCount })}`
                  : t("quoteNoRatingYet")}
              </Text>
            </View>

            {pro && pro.jobs_completed > 0 ? (
              <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>
                {t("quoteJobsDone", { n: pro.jobs_completed })}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={10}
          accessibilityLabel={t("quoteMoreActions")}
          style={({ pressed }) => ({ padding: 2, opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.faint} />
        </Pressable>
      </View>

      {/* availability — a professional who is taking work today is worth as much
          as the price when you're choosing between two of them */}
      {available ? (
        <View style={{ ...ROW }}>
          <View
            style={{
              ...ROW,
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.successTint,
              borderRadius: radius.full,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <View
              style={{ width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.success }}
            />
            <Text style={{ color: colors.success, fontSize: 11.5, fontWeight: "800" }}>
              {t("quoteAvailableNow")}
            </Text>
          </View>
        </View>
      ) : null}

      {/* the money and the arrival time — the two facts being compared, stacked
          so they land at the same height on every card */}
      <View
        style={{
          backgroundColor: colors.brandTint,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          gap: 6,
        }}
      >
        <Text style={[RTL_TEXT, { color: colors.brandDark, fontSize: 11.5, fontWeight: "700" }]}>
          {t("quotePriceLabel")}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[price ? MONEY_TEXT : RTL_TEXT, { color: colors.brand, fontSize: 26, fontWeight: "800" }]}
        >
          {price || t("quoteNoPrice")}
        </Text>
        {offer.eta_minutes != null ? (
          <View style={{ ...ROW, alignItems: "center", gap: 6 }}>
            <MaterialCommunityIcons name="clock-fast" size={14} color={colors.brandDark} />
            <Text style={{ color: colors.brandDark, fontSize: 12.5, fontWeight: "700" }}>
              {t("quoteEta", { n: offer.eta_minutes })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* the note, clamped. On a comparison screen four lines from one
          professional buries the card underneath it. */}
      {offer.message ? (
        <Text
          numberOfLines={expanded ? undefined : 2}
          style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 20 }]}
        >
          {offer.message}
        </Text>
      ) : null}

      {/* the accordion carries what the clamp hid, plus the facts that don't
          earn a permanent line */}
      {expanded ? (
        <View style={{ gap: 8, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md }}>
          {pro?.city ? (
            <View style={{ ...ROW, gap: 7, alignItems: "center" }}>
              <Ionicons name="location-outline" size={14} color={colors.faint} />
              <Text style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 12.5 }]}>
                {loc(pro.city, "name")}
              </Text>
            </View>
          ) : null}
          {pro?.bio ? (
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, lineHeight: 19 }]}>{pro.bio}</Text>
          ) : null}
          <Pressable
            onPress={openProfile}
            style={({ pressed }) => ({ ...ROW, gap: 5, alignItems: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: colors.brand, fontSize: 12.5, fontWeight: "700" }}>
              {t("quoteProProfile")}
            </Text>
            <Ionicons name="chevron-back" size={13} color={colors.brand} />
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => setExpanded((v) => !v)}
        hitSlop={6}
        style={({ pressed }) => ({ ...ROW, gap: 5, alignItems: "center", opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>
          {expanded ? t("quoteLessDetails") : t("quoteMoreDetails")}
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
      </Pressable>

      {/* accepting is the decision; chatting is how you get to it. Declining is
          neither, so it lives in the overflow — an offer you don't want can
          simply be left alone. */}
      <View style={{ ...ROW, gap: spacing.sm }}>
        <Button
          title={t("quoteAccept")}
          icon="check"
          loading={busy}
          disabled={locked}
          onPress={() => onAccept(offer)}
          style={{ flex: 1 }}
        />
        <Button
          title={t("quoteChatShort")}
          icon="chat-outline"
          variant="outline"
          disabled={locked}
          onPress={() => onChat(offer)}
          style={{ flex: 0.62 }}
        />
      </View>

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setMenuOpen(false)} />
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: spacing.xxl,
              gap: 2,
            }}
          >
            <SheetHandle />
            <Text
              numberOfLines={1}
              style={[RTL_TEXT, { color: colors.faint, fontSize: 12.5, paddingBottom: 4 }]}
            >
              {name || t("quoteUnknownPro")}
            </Text>
            {menuRow("person-outline", t("quoteProProfile"), openProfile)}
            {menuRow("chatbubble-outline", t("quoteChatInApp"), () => onChat(offer))}
            <View style={{ height: 1, backgroundColor: colors.hairline, marginVertical: 4 }} />
            {menuRow("close-circle-outline", t("quoteDecline"), () => onDecline(offer), true)}
          </View>
        </View>
      </Modal>
    </View>
  );
}
