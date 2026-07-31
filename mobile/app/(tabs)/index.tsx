// Customer home — greeting, search, banners, category grid, open-request CTA, top-rated pros.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { fetchCategories } from "../../lib/refdata";
import { STATUS_KEY, STATUS_TONE } from "../../lib/format";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Badge, Button, EmptyState, Loading, SectionHeader } from "../../components/ui";
import { ProCard } from "../../components/ProCard";
import type { Banner, Booking, Category, ProCard as ProCardType } from "../../lib/types";

const PRO_SELECT =
  "*, profile:profiles!professionals_id_fkey!inner(*), professional_categories(category:categories(*)), city:cities(*)";

/** icons come from the DB — never trust them blindly */
function safeIcon(icon?: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  return (icon && MaterialCommunityIcons.glyphMap[icon as keyof typeof MaterialCommunityIcons.glyphMap]
    ? icon
    : "tools") as keyof typeof MaterialCommunityIcons.glyphMap;
}

const ACTIVE_STATUSES = ["open", "pending", "accepted", "on_the_way", "in_progress"];
/** statuses that change in real time while the customer watches */
const LIVE_STATUSES = new Set(["open", "on_the_way", "in_progress"]);

function mapPro(row: any): ProCardType {
  return {
    ...row,
    profile: row.profile ?? undefined,
    categories: (row.professional_categories ?? [])
      .map((pc: any) => pc.category)
      .filter(Boolean),
    city: row.city ?? null,
  };
}

// ---------- subtle pulse dot for live booking statuses ----------
function PulseDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: color,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ---------- banners carousel (auto-scroll, RTL: inverted) ----------
function BannerCarousel({ banners, width }: { banners: Banner[]; width: number }) {
  const router = useRouter();
  const listRef = useRef<FlatList<Banner>>(null);
  const indexRef = useRef(0);

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
      renderItem={({ item }) => (
        <Pressable
          onPress={() => openBanner(item)}
          style={({ pressed }) => [{ width, transform: [{ scale: pressed && item.link ? 0.98 : 1 }] }]}
        >
          <View style={{ paddingHorizontal: 4 }}>
            <Image
              source={{ uri: item.image_url }}
              style={{ width: width - 8, height: 140, borderRadius: radius.lg }}
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
  const { t, loc } = useI18n();
  const { session } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const uid = session?.user.id;

  const [banners, setBanners] = useState<Banner[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [pros, setPros] = useState<ProCardType[]>([]);
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
      .select("*, category:categories(*)")
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
    const [bRes, cRes, pRes] = await Promise.allSettled([
      supabase.from("banners").select("*").eq("is_active", true).order("sort_order"),
      fetchCategories(true),
      supabase
        .from("professionals")
        .select(PRO_SELECT)
        .eq("profile.is_banned", false)
        .order("rating_avg", { ascending: false })
        .order("rating_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      loadActiveBooking(),
    ]);

    if (bRes.status === "fulfilled" && !bRes.value.error) {
      setBanners((bRes.value.data as Banner[]) ?? []);
    }
    if (cRes.status === "fulfilled") setCats(cRes.value);

    if (pRes.status === "fulfilled" && !pRes.value.error) {
      setPros(((pRes.value.data as any[]) ?? []).map(mapPro));
    } else {
      // Only the pros list is essential enough to surface a retry.
      setError(true);
    }
  }, [loadActiveBooking]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // realtime: my bookings change (or offers arrive) → refresh the active-request card
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`home-active-${uid}`)
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
  if (loading) return <Loading />;

  const tileGap = spacing.md;
  const tileW = (width - spacing.lg * 2 - tileGap * 3) / 4;
  const bannerW = width - spacing.lg * 2;

  const header = (
    <View style={{ gap: spacing.lg }}>
      {/* 1 — prompt heading */}
      <View style={{ marginTop: spacing.xs }}>
        <Text style={[RTL_TEXT, { color: colors.text, fontSize: 22, fontWeight: "800" }]}>
          {t("homeSubtitle")}
        </Text>
      </View>

      {/* 2 — readonly search bar -> /search */}
      <Pressable
        onPress={() => router.push("/search")}
        style={({ pressed }) => [
          {
            ...ROW,
            gap: 8,
            backgroundColor: colors.card,
            borderRadius: radius.full,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.card,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.faint} />
        <Text style={[RTL_TEXT, { flex: 1, color: colors.faint, fontSize: 14.5 }]}>
          {t("homeSearchPlaceholder")}
        </Text>
      </Pressable>

      {/* 2.5 — current request card (live booking status at a glance) */}
      {activeBooking ? (
        <Pressable
          onPress={() => router.push(`/booking/${activeBooking.id}`)}
          style={({ pressed }) => [
            {
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              padding: spacing.md,
              ...shadows.card,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <View style={{ ...ROW, gap: 12 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.tile,
                backgroundColor: colors.brandTint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name={safeIcon(activeBooking.category?.icon)} size={24} color={colors.brand} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[RTL_TEXT, { color: colors.brand, fontSize: 11, fontWeight: "700" }]}>
                {t("homeActiveRequest")}
              </Text>
              <Text
                numberOfLines={1}
                style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800" }]}
              >
                {activeBooking.category ? loc(activeBooking.category, "name") : activeBooking.title}
              </Text>
              <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>
                {activeBooking.status === "open"
                  ? offersCount > 0
                    ? t("homeOffersCount", { count: offersCount })
                    : t("waitingOffersTitle")
                  : activeBooking.title}
              </Text>
            </View>
            {LIVE_STATUSES.has(activeBooking.status) ? <PulseDot color={colors.brand} /> : null}
            <Badge label={t(STATUS_KEY[activeBooking.status])} tone={STATUS_TONE[activeBooking.status]} />
            <Ionicons name="chevron-back" size={16} color={colors.faint} />
          </View>
        </Pressable>
      ) : null}

      {/* 3 — banners */}
      {banners.length > 0 ? <BannerCarousel banners={banners} width={bannerW} /> : null}

      {/* 4 — categories grid */}
      <View>
        <SectionHeader title={t("categories")} action={t("seeAll")} onAction={() => router.push("/search")} />
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: tileGap }}>
          {cats.slice(0, 11).map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => router.push(`/category/${cat.id}`)}
              style={({ pressed }) => [
                { width: tileW, alignItems: "center", gap: 6, transform: [{ scale: pressed ? 0.95 : 1 }] },
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
              <Text
                numberOfLines={2}
                style={{
                  color: colors.text,
                  fontSize: 11.5,
                  fontWeight: "600",
                  textAlign: "center",
                  minHeight: 30,
                }}
              >
                {loc(cat, "name")}
              </Text>
            </Pressable>
          ))}
          {/* more tile */}
          <Pressable
            onPress={() => router.push("/search")}
            style={({ pressed }) => [
              { width: tileW, alignItems: "center", gap: 6, transform: [{ scale: pressed ? 0.95 : 1 }] },
            ]}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: radius.tile,
                backgroundColor: colors.brandTint,
                alignItems: "center",
                justifyContent: "center",
                ...shadows.card,
              }}
            >
              <MaterialCommunityIcons name="dots-horizontal" size={26} color={colors.brand} />
            </View>
            <Text
              numberOfLines={2}
              style={{
                color: colors.brand,
                fontSize: 11.5,
                fontWeight: "700",
                textAlign: "center",
                minHeight: 30,
              }}
            >
              {t("homeMoreTile")}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* error banner */}
      {error ? (
        <View
          style={{
            backgroundColor: colors.dangerTint,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 13.5, fontWeight: "600" }]}>
            {t("error")}
          </Text>
          <Button title={t("retry")} variant="outline" small onPress={onRefresh} />
        </View>
      ) : null}

      {/* 6 — top rated */}
      <SectionHeader title={t("homeTopRated")} action={t("seeAll")} onAction={() => router.push("/search")} />
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
      data={pros}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <ProCard pro={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        !error ? <EmptyState icon="account-hard-hat" title={t("homeNoProsYet")} /> : null
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
