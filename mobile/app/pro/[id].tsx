// Public professional profile — hero, actions (book/message/favorite/report),
// working hours, gallery with fullscreen viewer, reviews.
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
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
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Avatar, Badge, Button, Card, EmptyState, Loading, SectionHeader, StarRating } from "../../components/ui";
import type { GalleryItem, ProCard as ProCardType, Review } from "../../lib/types";

const PRO_SELECT =
  "*, profile:profiles!professionals_id_fkey(*), professional_categories(category:categories(*)), city:cities(*)";

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
  const [isFav, setIsFav] = useState(false);
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
      const [pRes, gRes, rRes, fRes] = await Promise.all([
        supabase.from("professionals").select(PRO_SELECT).eq("id", proId).maybeSingle(),
        supabase
          .from("gallery_items")
          .select("*")
          .eq("professional_id", proId)
          .order("created_at", { ascending: false }),
        supabase
          .from("reviews")
          .select("*, customer:profiles(*)")
          .eq("professional_id", proId)
          .order("created_at", { ascending: false })
          .limit(10),
        uid && uid !== proId
          ? supabase
              .from("favorites")
              .select("professional_id")
              .eq("customer_id", uid)
              .eq("professional_id", proId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);
      if (pRes.error) throw pRes.error;
      setPro(pRes.data ? mapPro(pRes.data) : null);
      setGallery((gRes.data as GalleryItem[]) ?? []);
      setReviews((rRes.data as Review[]) ?? []);
      setIsFav(!!fRes.data);
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

  const toggleFav = async () => {
    if (!uid || !pro) return;
    const next = !isFav;
    setIsFav(next); // optimistic
    if (next) {
      const { error: err } = await supabase
        .from("favorites")
        .insert({ customer_id: uid, professional_id: pro.id });
      if (err) setIsFav(false);
    } else {
      const { error: err } = await supabase
        .from("favorites")
        .delete()
        .eq("customer_id", uid)
        .eq("professional_id", pro.id);
      if (err) setIsFav(true);
    }
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

  if (authLoading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (loading) return <Loading />;

  const name = pro ? pro.business_name || pro.profile?.full_name || "" : "";
  const firstCatId = pro?.categories?.[0]?.id;
  const wh = pro?.working_hours ?? {};
  const hasHours = Object.keys(wh).length > 0;
  const banned = !!pro?.profile?.is_banned;

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
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
          ...shadows.card,
        }}
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

  const iconAction = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    color: string,
    onPress: () => void,
    busy?: boolean
  ) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          paddingVertical: 10,
          borderRadius: radius.md,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: busy ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={20} color={color} />
      )}
      <Text numberOfLines={1} style={{ color, fontSize: 11.5, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );

  const statChip = (
    icon: keyof typeof MaterialCommunityIcons.glyphMap,
    value: string,
    label: string
  ) => (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        gap: 2,
        backgroundColor: colors.chip,
        borderRadius: radius.md,
        paddingVertical: 10,
        paddingHorizontal: 4,
      }}
    >
      <View style={{ ...ROW, gap: 4 }}>
        <MaterialCommunityIcons name={icon} size={14} color={colors.brand} />
        <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: "800" }}>{value}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
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
        {/* ---- hero ---- */}
        <Card style={{ alignItems: "center", gap: spacing.sm }}>
          <Avatar uri={pro.profile?.avatar_url} name={name} size={72} />
          <View style={{ ...ROW, gap: 6 }}>
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 19, fontWeight: "800" }]}>{name}</Text>
            {pro.verification_status === "approved" ? (
              <MaterialCommunityIcons name="check-decagram" size={19} color={colors.info} />
            ) : null}
          </View>
          {pro.categories?.length ? (
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
              {pro.categories.map((c) => (
                <View
                  key={c.id}
                  style={{
                    backgroundColor: colors.brandTint,
                    borderRadius: radius.full,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: colors.brand, fontSize: 12, fontWeight: "700" }}>
                    {loc(c, "name")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ ...ROW, gap: 10 }}>
            {pro.city ? (
              <View style={{ ...ROW, gap: 4 }}>
                <Ionicons name="location-outline" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>
                  {loc(pro.city, "name")}
                </Text>
              </View>
            ) : null}
            <Badge
              label={pro.is_available ? t("available") : t("unavailable")}
              tone={pro.is_available ? "success" : "neutral"}
            />
          </View>
          {/* stat chips: rating avg / reviews / jobs completed */}
          <View style={{ ...ROW, gap: 8, alignSelf: "stretch", marginTop: 4 }}>
            {statChip(
              "star",
              pro.rating_count > 0 ? Number(pro.rating_avg).toFixed(1) : "—",
              t("rating")
            )}
            {statChip("star-box-multiple-outline", String(pro.rating_count), t("reviews"))}
            {statChip("briefcase-check-outline", String(pro.jobs_completed), t("jobsCompleted"))}
          </View>
        </Card>

        {/* ---- actions / own-profile hint ---- */}
        {isOwn ? (
          <Card style={{ ...ROW, gap: 10 }}>
            <MaterialCommunityIcons name="information-outline" size={20} color={colors.brand} />
            <Text style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 13 }]}>
              {t("proOwnProfileHint")}
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {!pro.is_available ? (
              <View
                style={{
                  ...ROW,
                  gap: 10,
                  backgroundColor: colors.chip,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                }}
              >
                <Ionicons name="moon-outline" size={17} color={colors.muted} />
                <Text style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 12.5, lineHeight: 18 }]}>
                  {t("proUnavailableBanner")}
                </Text>
              </View>
            ) : null}
            <View style={{ ...ROW, gap: 10 }}>
              {iconAction("chatbubble-ellipses-outline", t("message"), colors.text, openChat, chatLoading)}
              {iconAction(
                isFav ? "heart" : "heart-outline",
                t("proFavorite"),
                isFav ? colors.danger : colors.text,
                toggleFav
              )}
              {iconAction("flag-outline", t("report"), colors.text, () =>
                router.push(`/report?userId=${pro.id}`)
              )}
            </View>
            <Button
              title={t("proBookNow")}
              icon="calendar-check"
              onPress={() =>
                router.push(
                  `/create-booking?proId=${pro.id}${firstCatId != null ? `&categoryId=${firstCatId}` : ""}`
                )
              }
            />
          </View>
        )}

        {/* ---- bio ---- */}
        {pro.bio ? (
          <View>
            <SectionHeader title={t("proAbout")} />
            <Card>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 14, lineHeight: 22 }]}>{pro.bio}</Text>
            </Card>
          </View>
        ) : null}

        {/* ---- working hours (Sunday first, keys "0".."6") ---- */}
        {hasHours ? (
          <View>
            <SectionHeader title={t("proWorkingHours")} />
            <Card style={{ gap: 0, paddingVertical: spacing.sm }}>
              {[0, 1, 2, 3, 4, 5, 6].map((d, i) => {
                const h = wh[String(d)];
                return (
                  <View
                    key={d}
                    style={{
                      ...ROW,
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      borderBottomWidth: i < 6 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={[RTL_TEXT, { color: colors.text, fontSize: 13.5, fontWeight: "600" }]}>
                      {t(`proDay${d}`)}
                    </Text>
                    {h ? (
                      <Text style={{ color: colors.muted, fontSize: 13 }}>
                        {h.from} – {h.to}
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

        {/* ---- gallery ---- */}
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
                    style={{ width: 110, height: 110, borderRadius: radius.md, backgroundColor: colors.chip }}
                    contentFit="cover"
                    transition={150}
                  />
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* ---- reviews ---- */}
        <View>
          <SectionHeader title={t("reviews")} />
          <Card style={{ gap: spacing.md }}>
            {/* breakdown line */}
            <View style={{ ...ROW, gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 34, fontWeight: "800" }}>
                {pro.rating_count > 0 ? Number(pro.rating_avg).toFixed(1) : "—"}
              </Text>
              <View style={{ gap: 2 }}>
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
                      paddingTop: spacing.sm,
                      borderTopWidth: i === 0 ? 1 : 0.5,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Avatar uri={r.customer?.avatar_url} name={custName} size={36} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ ...ROW, justifyContent: "space-between" }}>
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
