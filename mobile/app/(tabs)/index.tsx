// Customer home — a service picker. There is no professional directory: the
// customer taps the trade they need and we collect quotes for them.
//
// The screen is deliberately quiet: one status card (only when a request is
// live), one search pill, and the service grid as the hero. Everything else
// was noise and has been removed.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { channelTopic } from "../../lib/realtime";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { fetchCategories, popularCategories } from "../../lib/refdata";
import { STATUS_KEY, STATUS_TONE, formatTime } from "../../lib/format";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import {
  Badge,
  Button,
  EmptyState,
  InlineNote,
  SectionHeader,
  SkeletonList,
  pressCard,
  pressCta,
} from "../../components/ui";
import type { Banner, Booking, Category } from "../../lib/types";

/** icons come from the DB — never trust them blindly */
function safeIcon(icon?: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  return (icon && MaterialCommunityIcons.glyphMap[icon as keyof typeof MaterialCommunityIcons.glyphMap]
    ? icon
    : "tools") as keyof typeof MaterialCommunityIcons.glyphMap;
}

const ACTIVE_STATUSES = ["open", "pending", "accepted", "on_the_way", "in_progress"];

// ---------- the helper card's mark ----------
// Drawn rather than shipped as a PNG: it has to recolour with the theme (this
// card sits on brandTint in light and on a dark tint at night), it stays sharp
// at any density, and it adds nothing to the bundle.
function HelperMark() {
  const { colors, shadows } = useTheme();
  return (
    <View style={{ width: 76, height: 72 }}>
      {/* the house — the job */}
      <View
        style={{
          position: "absolute",
          right: 4,
          bottom: 0,
          width: 62,
          height: 62,
          borderRadius: radius.xl,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
          ...shadows.card,
        }}
      >
        <MaterialCommunityIcons name="home-variant-outline" size={30} color={colors.brand} />
      </View>
      {/* the question — overlapping, so the two read as one object */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 30,
          height: 30,
          borderRadius: radius.full,
          backgroundColor: colors.brand,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="chat-question-outline" size={16} color={colors.onBrand} />
      </View>
    </View>
  );
}

// ---------- banners carousel (auto-scroll; RTL: `inverted` starts from the right) ----------
function BannerCarousel({ banners, width }: { banners: Banner[]; width: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const listRef = useRef<FlatList<Banner>>(null);
  const indexRef = useRef(0);
  const height = Math.round(width * 0.42);

  useEffect(() => {
    if (banners.length < 2) return;
    const iv = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % banners.length;
      try {
        listRef.current?.scrollToIndex({ index: indexRef.current, animated: true });
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [banners.length, width]);

  const openBanner = (b: Banner) => {
    if (!b.link) return;
    if (b.link.startsWith("http")) Linking.openURL(b.link).catch(() => {});
    else if (b.link.startsWith("/")) router.push(b.link as any);
  };

  return (
    <FlatList
      ref={listRef}
      data={banners}
      horizontal
      inverted
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={(b) => b.id}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      onMomentumScrollEnd={(e) => {
        const i = Math.round(e.nativeEvent.contentOffset.x / width);
        if (i >= 0 && i < banners.length) indexRef.current = i;
      }}
      style={{ flexGrow: 0 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => openBanner(item)}
          style={({ pressed }) => [{ width }, pressed && item.link ? pressCard : null]}
        >
          <View style={{ paddingHorizontal: 4 }}>
            <Image
              source={{ uri: item.image_url }}
              style={{ width: width - 8, height, borderRadius: radius.lg, backgroundColor: colors.chip }}
              contentFit="cover"
              transition={200}
            />
          </View>
        </Pressable>
      )}
    />
  );
}

export default function HomeScreen() {
  const { colors, shadows } = useTheme();
  const { t, loc, lang } = useI18n();
  const { session } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const uid = session?.user.id;

  const [banners, setBanners] = useState<Banner[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [offersCount, setOffersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  // latest in-flight request for this customer (open/pending/accepted/on_the_way/in_progress)
  const loadActiveBooking = useCallback(async () => {
    if (!uid) return;
    const { data, error: err } = await supabase
      .from("bookings")
      .select("*, category:categories(*), city:cities(*)")
      .eq("customer_id", uid)
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1);
    if (err) return; // non-essential section — keep whatever we had
    const b = ((data as Booking[]) ?? [])[0] ?? null;
    if (b && b.status === "open") {
      const { count } = await supabase
        .from("offers")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", b.id)
        .neq("status", "withdrawn");
      setOffersCount(count ?? 0);
    } else {
      setOffersCount(0);
    }
    setActiveBooking(b);
  }, [uid]);

  const load = useCallback(async () => {
    setError(false);
    // Load each section independently so one failure never blanks the others.
    const [bRes, cRes] = await Promise.allSettled([
      supabase.from("banners").select("*").eq("is_active", true).order("sort_order"),
      fetchCategories(true),
      loadActiveBooking(),
    ]);

    if (bRes.status === "fulfilled" && !bRes.value.error) {
      setBanners((bRes.value.data as Banner[]) ?? []);
    }
    // The service grid *is* the screen — only its failure is worth a retry.
    if (cRes.status === "fulfilled") setCats(cRes.value);
    else setError(true);
  }, [loadActiveBooking]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // realtime: my bookings change (or offers arrive) → refresh the active-request card
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(channelTopic(`home-active-${uid}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `customer_id=eq.${uid}` },
        () => {
          loadActiveBooking();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers" },
        () => {
          loadActiveBooking(); // RLS scopes visible offers to my open bookings
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, loadActiveBooking]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!session) return null; // tabs layout redirects; safety guard
  if (loading) return <SkeletonList count={4} />;

  // the short, curated set that leads the screen
  const popular = popularCategories(cats);

  const tileGap = spacing.md;
  const tileW = (width - spacing.lg * 2 - tileGap * 3) / 4;
  const bannerW = width - spacing.lg * 2;

  /** the single line of context under the active request's title */
  const activeContext = (b: Booking) => {
    if (b.status === "open") {
      return offersCount > 0 ? t("homeOffersCount", { count: offersCount }) : t("waitingOffersTitle");
    }
    return b.title.trim() || t("homeTrackRequest");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* 1 — read-only search pill → /search (finds services, never people) */}
      <Pressable
        onPress={() => router.push("/search")}
        style={({ pressed }) => [
          {
            ...ROW,
            gap: spacing.sm,
            backgroundColor: colors.card,
            borderRadius: radius.full,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            ...shadows.card,
          },
          pressed ? pressCard : null,
        ]}
      >
        <Ionicons name="search" size={18} color={colors.faint} />
        <Text numberOfLines={1} style={[RTL_TEXT, { flex: 1, color: colors.faint, fontSize: 14.5 }]}>
          {t("homeSearchPlaceholder")}
        </Text>
      </Pressable>

      {/* 2 — banners (renders nothing at all when there are none) */}
      {banners.length > 0 ? <BannerCarousel banners={banners} width={bannerW} /> : null}

      {/* the grid failed to load — the only thing worth retrying */}
      {error ? (
        <View style={{ gap: spacing.sm }}>
          <InlineNote tone="danger" icon="cloud-off-outline" text={t("searchErrorTitle")} />
          <Button title={t("retry")} variant="outline" small onPress={onRefresh} />
        </View>
      ) : null}

      {/* 3 — the hero: the most-requested trades, everything else one tap away.
             Showing all 32 at once was a wall of choice. */}
      <View>
        <SectionHeader title={t("homePopularTitle")} />
        <Text
          style={[
            RTL_TEXT,
            { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: -spacing.xs, marginBottom: spacing.lg },
          ]}
        >
          {t("homeServicesSubtitle")}
        </Text>

        {cats.length === 0 ? (
          !error ? <EmptyState icon="shape-outline" title={t("homeNoServices")} /> : null
        ) : (
          <View
            style={{
              flexDirection: "row-reverse", // fills from the right
              flexWrap: "wrap",
              alignItems: "flex-start",
              columnGap: tileGap,
              rowGap: spacing.lg,
            }}
          >
            {popular.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => router.push(`/create-booking?categoryId=${cat.id}`)}
                style={({ pressed }) => [
                  { width: tileW, alignItems: "center", gap: spacing.sm },
                  pressed ? pressCard : null,
                ]}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: radius.tile,
                    backgroundColor: colors.card,
                    alignItems: "center",
                    justifyContent: "center",
                    ...shadows.card,
                  }}
                >
                  <MaterialCommunityIcons name={safeIcon(cat.icon)} size={26} color={colors.brand} />
                </View>
                {/* fixed height for exactly two lines so every row lines up */}
                <Text
                  numberOfLines={2}
                  style={{
                    color: colors.text,
                    fontSize: 11.5,
                    fontWeight: "600",
                    textAlign: "center",
                    writingDirection: "rtl",
                    lineHeight: 16,
                    height: 32,
                  }}
                >
                  {loc(cat, "name")}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* everything we didn't lead with */}
        {cats.length > popular.length ? (
          <Pressable
            onPress={() => router.push("/search")}
            style={({ pressed }) => [
              {
                ...ROW,
                justifyContent: "center",
                gap: 8,
                marginTop: spacing.xl,
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                ...shadows.card,
              },
              pressed ? pressCard : null,
            ]}
          >
            <MaterialCommunityIcons name="view-grid-outline" size={19} color={colors.brand} />
            <Text style={{ color: colors.brand, fontSize: 14.5, fontWeight: "800" }}>
              {t("homeAllServices", { count: cats.length })}
            </Text>
            <Ionicons name="chevron-back" size={16} color={colors.brand} />
          </Pressable>
        ) : null}
      </View>

      {/* 4 — for the customer who can't name the trade. The grid asks a question
             someone whose kitchen is flooding can't answer; this one takes the
             problem in their own words and names the trade for them. */}
      <View
        style={{
          backgroundColor: colors.brandTint,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <View style={{ ...ROW, alignItems: "center", gap: spacing.md }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17.5, fontWeight: "800" }]}>
              {t("homeAiTitle")}
            </Text>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, lineHeight: 19 }]}>
              {t("homeAiSubtitle")}
            </Text>
          </View>
          <HelperMark />
        </View>

        <Pressable
          onPress={() => router.push("/quick-request")}
          style={({ pressed }) => [
            {
              ...ROW,
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              backgroundColor: colors.brand,
              borderRadius: radius.full,
              paddingVertical: 14,
              ...shadows.cta,
            },
            pressed ? pressCta : null,
          ]}
        >
          <MaterialCommunityIcons name="star-four-points" size={17} color={colors.onBrand} />
          <Text style={{ color: colors.onBrand, fontSize: 15, fontWeight: "800" }}>
            {t("homeAiCta")}
          </Text>
          <Ionicons name="chevron-back" size={16} color={colors.onBrand} />
        </Pressable>
      </View>

      {/* 5 — the live request. It sits last on purpose: someone with a job in
             flight opens the app to check on it, and the tail of the screen is
             where the eye lands after scrolling past what it already knows.
             The section always renders — the placeholder holds the slot so the
             page doesn't visibly restructure itself the moment a request lands. */}
      <View>
        <SectionHeader title={t("homeMyRequest")} />
        {activeBooking ? (
          <Pressable
            onPress={() => router.push(`/booking/${activeBooking.id}`)}
            style={({ pressed }) => [
              {
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                padding: spacing.md,
                gap: spacing.md,
                ...shadows.card,
              },
              pressed ? pressCard : null,
            ]}
          >
            <View style={{ ...ROW, alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.tile,
                  backgroundColor: colors.brandTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons
                  name={safeIcon(activeBooking.category?.icon)}
                  size={22}
                  color={colors.brand}
                />
              </View>

              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
                  {activeBooking.category ? loc(activeBooking.category, "name") : activeBooking.title}
                </Text>
                <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5 }]}>
                  {activeContext(activeBooking)}
                </Text>
              </View>

              <Badge label={t(STATUS_KEY[activeBooking.status])} tone={STATUS_TONE[activeBooking.status]} />
            </View>

            {/* where and when — only the parts we actually have */}
            {activeBooking.city || activeBooking.address || activeBooking.created_at ? (
              <View style={{ ...ROW, alignItems: "center", gap: spacing.lg }}>
                {activeBooking.city || activeBooking.address ? (
                  <View style={{ ...ROW, alignItems: "center", gap: 5, flex: 1 }}>
                    <Ionicons name="location-outline" size={14} color={colors.faint} />
                    <Text numberOfLines={1} style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 12 }]}>
                      {activeBooking.city ? loc(activeBooking.city, "name") : activeBooking.address}
                    </Text>
                  </View>
                ) : null}
                <View style={{ ...ROW, alignItems: "center", gap: 5 }}>
                  <Ionicons name="calendar-outline" size={14} color={colors.faint} />
                  {/* dates stay LTR — an RTL run flips 12.05 to 05.12 */}
                  <Text style={{ color: colors.muted, fontSize: 12, writingDirection: "ltr" }}>
                    {formatTime(activeBooking.created_at, lang)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={ROW}>
              <View
                style={{
                  ...ROW,
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: colors.brandTint,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: colors.brand, fontSize: 12.5, fontWeight: "700" }}>
                  {t("homeTrackCta")}
                </Text>
                <Ionicons name="chevron-back" size={13} color={colors.brand} />
              </View>
            </View>
          </Pressable>
        ) : (
          // Deliberately flat — no shadow, no CTA. The real card above lifts off
          // the page when a request exists, and the helper card already owns the
          // only button this part of the screen needs.
          <View
            style={{
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.xl,
              paddingHorizontal: spacing.lg,
            }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: radius.full,
                backgroundColor: colors.chip,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="clipboard-text-outline" size={25} color={colors.faint} />
            </View>
            <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: "700", textAlign: "center" }}>
              {t("homeNoRequestTitle")}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 12.5,
                lineHeight: 18,
                textAlign: "center",
                paddingHorizontal: spacing.md,
              }}
            >
              {t("homeNoRequestSubtitle")}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
