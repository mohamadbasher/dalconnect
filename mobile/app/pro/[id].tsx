// Public professional profile — the page a customer reads before accepting that
// pro's quote. Trust first: hero (photo, name, verified, rating, jobs), then bio,
// hours, gallery, reviews. No direct booking and no phone number here: customers
// choose a quote, and the number is released only by `get_contact_phone` once the
// offer is accepted.
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { getOrCreateConversation } from "../../lib/chat";
import { formatTime } from "../../lib/format";
import { hasWorkingHours, isOpenNow, todayHoursLabel } from "../../lib/hours";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Avatar, Button, Card, EmptyState, Loading, SectionHeader, StarRating } from "../../components/ui";
import type { GalleryItem, ProCard as ProCardType, Review } from "../../lib/types";
import { PROFILE_FIELDS } from "../../lib/queries";

const PRO_SELECT =
  `*, profile:profiles!professionals_id_fkey(${PROFILE_FIELDS}), professional_categories(category:categories(*)), city:cities(*)`;

/** Clock times and counts are Latin digits — keep them LTR inside the RTL layout. */
const LTR: TextStyle = { writingDirection: "ltr" };

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

// ---------- fullscreen gallery viewer ----------
function GalleryViewer({
  items,
  initialIndex,
  onClose,
}: {
  items: GalleryItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // lightbox backdrop is intentionally near-black in both themes
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
        <FlatList
          data={items}
          horizontal
          inverted
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => (
            <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
              <Image
                source={{ uri: item.image_url }}
                style={{ width, height: height * 0.75 }}
                contentFit="contain"
                transition={150}
              />
              {item.caption ? (
                <Text
                  style={[
                    RTL_TEXT,
                    {
                      position: "absolute",
                      bottom: insets.bottom + 32,
                      left: 24,
                      right: 24,
                      color: "#fff",
                      fontSize: 13.5,
                      textAlign: "center",
                    },
                  ]}
                >
                  {item.caption}
                </Text>
              ) : null}
            </View>
          )}
        />
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={{
            position: "absolute",
            top: insets.top + 10,
            // RTL: close sits on the start (right) edge
            right: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.18)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

export default function ProProfileScreen() {
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const proId = String(id ?? "");

  const [pro, setPro] = useState<ProCardType | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const uid = session?.user.id;
  const isOwn = uid === proId;

  const load = useCallback(async () => {
    if (!proId) return;
    try {
      setError(false);
      const [pRes, gRes, rRes] = await Promise.all([
        supabase.from("professionals").select(PRO_SELECT).eq("id", proId).maybeSingle(),
        supabase
          .from("gallery_items")
          .select("*")
          .eq("professional_id", proId)
          .order("created_at", { ascending: false }),
        supabase
          .from("reviews")
          .select(`*, customer:profiles(${PROFILE_FIELDS})`)
          .eq("professional_id", proId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (pRes.error) throw pRes.error;
      setPro(pRes.data ? mapPro(pRes.data) : null);
      setGallery((gRes.data as GalleryItem[]) ?? []);
      setReviews((rRes.data as Review[]) ?? []);
    } catch {
      setError(true);
    }
  }, [proId, uid]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openChat = async () => {
    if (!uid || !pro || chatLoading) return;
    setChatLoading(true);
    try {
      const cid = await getOrCreateConversation(uid, pro.id);
      router.push(`/chat/${cid}`);
    } catch {
      // silent — network hiccup; user can retry
    } finally {
      setChatLoading(false);
    }
  };

  const name = pro ? pro.business_name || pro.profile?.full_name || "" : "";

  const sharePro = useCallback(async () => {
    if (!pro) return;
    const trade = (pro.categories ?? []).map((c) => loc(c, "name")).join(" · ");
    try {
      // No public web profile exists yet — share plain text, never a fake URL.
      await Share.share({
        message: t("proShareMessage", {
          name,
          trade: trade || t("proShareTradeFallback"),
          app: t("appName"),
        }),
      });
    } catch {
      // user dismissed the sheet — nothing to report
    }
  }, [pro, name, loc, t]);

  if (authLoading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (loading) return <Loading />;

  const wh = pro?.working_hours ?? {};
  const hasHours = Object.keys(wh).length > 0;
  const banned = !!pro?.profile?.is_banned;
  // the pill only makes sense when at least one day is actually published
  const showStatus = hasWorkingHours(wh);
  const openNow = showStatus && isOpenNow(wh);
  const todayLabel = todayHoursLabel(wh, lang);
  const today = new Date().getDay();

  const header = (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
        ...ROW,
        gap: 12,
      }}
    >
      {/* RTL: back points to the right */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: radius.full,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.8 : 1,
          ...shadows.card,
        })}
      >
        <Ionicons name="arrow-forward" size={20} color={colors.text} />
      </Pressable>
      <Text
        numberOfLines={1}
        style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}
      >
        {name}
      </Text>
    </View>
  );

  if (!pro || banned || error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <EmptyState
            icon={error ? "alert-circle-outline" : "account-off-outline"}
            title={error ? t("error") : t("proNotFound")}
          />
          {error ? <Button title={t("retry")} variant="outline" onPress={onRefresh} /> : null}
        </View>
      </View>
    );
  }

  /** One of the three trust numbers under the hero. */
  const stat = (
    value: string,
    label: string,
    /** RTL: tiles run right-to-left, so every tile but the last carries the divider on its LEFT edge */
    divider: boolean,
    icon?: keyof typeof MaterialCommunityIcons.glyphMap
  ) => (
    <View
      key={label}
      style={{
        flex: 1,
        alignItems: "center",
        gap: 3,
        paddingVertical: spacing.md,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: colors.hairline,
      }}
    >
      <View style={{ ...ROW, gap: 4 }}>
        {icon ? <MaterialCommunityIcons name={icon} size={14} color={colors.gold} /> : null}
        <Text style={[LTR, { color: colors.text, fontSize: 16, fontWeight: "800" }]}>{value}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );

  /** Quiet secondary action — a bordered pill, never competing with the content. */
  const quietAction = (
    key: string,
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    busy?: boolean
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        ...ROW,
        flex: 1,
        justifyContent: "center",
        gap: 6,
        paddingVertical: 11,
        borderRadius: radius.full,
        backgroundColor: colors.card,
        opacity: busy ? 0.6 : pressed ? 0.85 : 1,
        ...shadows.card,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.brand} />
      ) : (
        <Ionicons name={icon} size={17} color={colors.brand} />
      )}
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12.5, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- hero ---------- */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <View style={{ alignItems: "center", gap: spacing.sm, padding: spacing.lg }}>
            <Avatar uri={pro.profile?.avatar_url} name={name} size={80} />

            <View style={{ ...ROW, gap: 6 }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 19, fontWeight: "800" }]}>{name}</Text>
              {pro.verification_status === "approved" ? (
                <MaterialCommunityIcons name="check-decagram" size={19} color={colors.info} />
              ) : null}
            </View>

            {pro.categories?.length ? (
              <View style={{ ...ROW, flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
                {pro.categories.map((c) => (
                  <View
                    key={c.id}
                    style={{
                      backgroundColor: colors.brandTint,
                      borderRadius: radius.full,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ color: colors.brand, fontSize: 12, fontWeight: "700" }}>{loc(c, "name")}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* where they work + whether they're open right now */}
            <View style={{ ...ROW, gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {pro.city ? (
                <View style={{ ...ROW, gap: 4 }}>
                  <Ionicons name="location-outline" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>
                    {loc(pro.city, "name")}
                  </Text>
                </View>
              ) : null}
              {showStatus ? (
                <View style={{ ...ROW, gap: 6 }}>
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: radius.full,
                      backgroundColor: openNow ? colors.success : colors.faint,
                    }}
                  />
                  <Text
                    style={{
                      color: openNow ? colors.success : colors.muted,
                      fontSize: 12.5,
                      fontWeight: "700",
                    }}
                  >
                    {openNow ? t("proOpenNow") : t("proClosedNow")}
                  </Text>
                  {/* "اليوم 09:00 – 21:00" mixes Arabic with clock times — RTL text, LTR digit runs */}
                  {todayLabel ? (
                    <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12.5 }]}>{todayLabel}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          {/* the three numbers a customer weighs a quote by */}
          <View style={{ ...ROW, borderTopWidth: 1, borderTopColor: colors.hairline }}>
            {stat(
              pro.rating_count > 0 ? Number(pro.rating_avg).toFixed(1) : "—",
              t("rating"),
              true,
              "star"
            )}
            {stat(String(pro.rating_count), t("reviews"), true)}
            {stat(String(pro.jobs_completed), t("jobsCompleted"), false)}
          </View>
        </Card>

        {/* ---------- own profile hint / quiet actions ---------- */}
        {isOwn ? (
          <Card style={{ ...ROW, gap: 10 }}>
            <MaterialCommunityIcons name="information-outline" size={20} color={colors.brand} />
            <Text style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 }]}>
              {t("proOwnProfileHint")}
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {!pro.is_available ? (
              <View
                style={{
                  ...ROW,
                  gap: 10,
                  alignItems: "flex-start",
                  backgroundColor: colors.chip,
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <Ionicons name="moon-outline" size={17} color={colors.muted} />
                <Text style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 12.5, lineHeight: 18 }]}>
                  {t("proUnavailableBanner")}
                </Text>
              </View>
            ) : null}
            <View style={{ ...ROW, gap: 10 }}>
              {quietAction("message", "chatbubble-ellipses-outline", t("message"), openChat, chatLoading)}
              {quietAction("share", "share-social-outline", t("share"), sharePro)}
              {quietAction("report", "flag-outline", t("report"), () =>
                router.push(`/report?userId=${pro.id}`)
              )}
            </View>
          </View>
        )}

        {/* ---------- bio ---------- */}
        {pro.bio ? (
          <View>
            <SectionHeader title={t("proAbout")} />
            <Card>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 14, lineHeight: 22 }]}>{pro.bio}</Text>
            </Card>
          </View>
        ) : null}

        {/* ---------- working hours (Sunday first, keys "0".."6") ---------- */}
        {hasHours ? (
          <View>
            <SectionHeader title={t("proWorkingHours")} />
            <Card style={{ paddingVertical: spacing.sm }}>
              {[0, 1, 2, 3, 4, 5, 6].map((d, i) => {
                const h = wh[String(d)];
                const isToday = d === today;
                return (
                  <View
                    key={d}
                    style={{
                      ...ROW,
                      justifyContent: "space-between",
                      paddingVertical: 9,
                      borderBottomWidth: i < 6 ? 1 : 0,
                      borderBottomColor: colors.hairline,
                    }}
                  >
                    <Text
                      style={[
                        RTL_TEXT,
                        {
                          color: isToday ? colors.brand : colors.text,
                          fontSize: 13.5,
                          fontWeight: isToday ? "800" : "600",
                        },
                      ]}
                    >
                      {t(`proDay${d}`)}
                    </Text>
                    {h ? (
                      <Text
                        style={[
                          LTR,
                          { color: isToday ? colors.brand : colors.muted, fontSize: 13, fontWeight: isToday ? "700" : "400" },
                        ]}
                      >
                        {`${h.from} – ${h.to}`}
                      </Text>
                    ) : (
                      <Text style={{ color: colors.faint, fontSize: 13 }}>{t("proClosed")}</Text>
                    )}
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}

        {/* ---------- gallery (inverted: the strip starts from the right) ---------- */}
        {gallery.length > 0 ? (
          <View>
            <SectionHeader title={t("proGallery")} />
            <FlatList
              data={gallery}
              horizontal
              inverted
              showsHorizontalScrollIndicator={false}
              keyExtractor={(g) => g.id}
              contentContainerStyle={{ gap: spacing.sm }}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => setViewerIndex(index)}
                  style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                >
                  <Image
                    source={{ uri: item.image_url }}
                    style={{ width: 116, height: 116, borderRadius: radius.md, backgroundColor: colors.chip }}
                    contentFit="cover"
                    transition={150}
                  />
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* ---------- reviews ---------- */}
        <View>
          <SectionHeader title={t("reviews")} />
          <Card style={{ gap: spacing.md }}>
            <View style={{ ...ROW, gap: 12 }}>
              <Text style={[LTR, { color: colors.text, fontSize: 34, fontWeight: "800" }]}>
                {pro.rating_count > 0 ? Number(pro.rating_avg).toFixed(1) : "—"}
              </Text>
              <View style={{ gap: 3, alignItems: "flex-end" }}>
                <StarRating rating={Number(pro.rating_avg)} size={15} />
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>
                  {t("proReviewsCount", { count: pro.rating_count })}
                </Text>
              </View>
            </View>

            {reviews.length === 0 ? (
              <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 13 }]}>{t("proNoReviews")}</Text>
            ) : (
              reviews.map((r, i) => {
                const custName =
                  (r.customer?.full_name ?? "").trim().split(/\s+/)[0] || t("proCustomerFallback");
                return (
                  <View
                    key={r.id}
                    style={{
                      ...ROW,
                      gap: 10,
                      paddingTop: spacing.md,
                      borderTopWidth: 1,
                      borderTopColor: colors.hairline,
                    }}
                  >
                    <Avatar uri={r.customer?.avatar_url} name={custName} size={36} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                        <Text style={[RTL_TEXT, { color: colors.text, fontSize: 13.5, fontWeight: "700" }]}>
                          {custName}
                        </Text>
                        <Text style={{ color: colors.faint, fontSize: 11.5 }}>
                          {formatTime(r.created_at, lang)}
                        </Text>
                      </View>
                      <StarRating rating={r.rating} size={13} />
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </View>
      </ScrollView>

      {viewerIndex !== null ? (
        <GalleryViewer items={gallery} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      ) : null}
    </View>
  );
}
