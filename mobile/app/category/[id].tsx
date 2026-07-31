// Category screen — pros in one category + filters + sticky open-request CTA.
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { fetchCategories, fetchCities } from "../../lib/refdata";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Button, Chip, EmptyState, Loading } from "../../components/ui";
import { ProCard } from "../../components/ProCard";
import { PickerSheet } from "../search";
import type { Category, City, ProCard as ProCardType } from "../../lib/types";

const PRO_SELECT =
  "*, profile:profiles!professionals_id_fkey!inner(*), professional_categories(category:categories(*)), city:cities(*), cat_filter:professional_categories!inner(category_id)";

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

type SortMode = "rating" | "newest";

export default function CategoryScreen() {
  const { colors, shadows } = useTheme();
  const { t, loc } = useI18n();
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);

  const [category, setCategory] = useState<Category | null>(null);
  const [catLoaded, setCatLoaded] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [pros, setPros] = useState<ProCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [cityId, setCityId] = useState<number | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("rating");
  const [sheet, setSheet] = useState<"city" | "sort" | null>(null);

  useEffect(() => {
    fetchCategories()
      .then((cats) => setCategory(cats.find((c) => c.id === categoryId) ?? null))
      .catch(() => {})
      .finally(() => setCatLoaded(true));
    fetchCities().then(setCities).catch(() => {});
  }, [categoryId]);

  const load = useCallback(async () => {
    if (!Number.isFinite(categoryId)) return;
    try {
      setError(false);
      let query = supabase
        .from("professionals")
        .select(PRO_SELECT)
        .eq("profile.is_banned", false)
        .eq("cat_filter.category_id", categoryId);
      if (cityId != null) query = query.eq("city_id", cityId);
      if (availableOnly) query = query.eq("is_available", true);
      if (verifiedOnly) query = query.eq("verification_status", "approved");
      query =
        sort === "rating"
          ? query.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false })
          : query.order("created_at", { ascending: false });
      const { data, error: err } = await query.limit(100);
      if (err) throw err;
      setPros(((data as any[]) ?? []).map(mapPro));
    } catch {
      setError(true);
    }
  }, [categoryId, cityId, availableOnly, verifiedOnly, sort]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (authLoading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;

  const selectedCity = cityId != null ? cities.find((c) => c.id === cityId) : null;

  const chips: {
    key: string;
    label: string;
    active: boolean;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    onPress: () => void;
  }[] = [
    {
      key: "city",
      label: selectedCity ? loc(selectedCity, "name") : t("city"),
      active: cityId != null,
      icon: "map-marker-outline",
      onPress: () => setSheet("city"),
    },
    {
      key: "available",
      label: t("available"),
      active: availableOnly,
      icon: "clock-check-outline",
      onPress: () => setAvailableOnly((v) => !v),
    },
    {
      key: "verified",
      label: t("verified"),
      active: verifiedOnly,
      icon: "check-decagram",
      onPress: () => setVerifiedOnly((v) => !v),
    },
    {
      key: "sort",
      label: sort === "rating" ? t("searchSortRating") : t("searchSortNewest"),
      active: false,
      icon: "sort",
      onPress: () => setSheet("sort"),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header: back + category icon + name */}
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
        {category ? (
          <>
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
                name={
                  (MaterialCommunityIcons.glyphMap[category.icon as keyof typeof MaterialCommunityIcons.glyphMap]
                    ? category.icon
                    : "tools") as keyof typeof MaterialCommunityIcons.glyphMap
                }
                size={23}
                color={colors.brand}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}
            >
              {loc(category, "name")}
            </Text>
          </>
        ) : (
          <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
            {catLoaded ? t("catNotFound") : ""}
          </Text>
        )}
      </View>

      {catLoaded && !category ? (
        <EmptyState icon="shape-outline" title={t("catNotFound")} />
      ) : (
        <>
          {/* filter chips */}
          <FlatList
            data={chips}
            horizontal
            inverted
            showsHorizontalScrollIndicator={false}
            keyExtractor={(c) => c.key}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm }}
            style={{ flexGrow: 0 }}
            renderItem={({ item }) => (
              <Chip label={item.label} active={item.active} icon={item.icon} onPress={item.onPress} />
            )}
          />

          {/* pros */}
          {loading ? (
            <Loading />
          ) : (
            <FlatList
              data={pros}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => <ProCard pro={item} />}
              contentContainerStyle={{
                padding: spacing.lg,
                paddingTop: spacing.sm,
                paddingBottom: spacing.xl,
                gap: spacing.md,
                flexGrow: 1,
              }}
              ListEmptyComponent={
                error ? (
                  <View style={{ gap: spacing.md }}>
                    <EmptyState icon="alert-circle-outline" title={t("error")} />
                    <Button title={t("retry")} variant="outline" onPress={onRefresh} />
                  </View>
                ) : (
                  <EmptyState
                    icon="account-hard-hat"
                    title={t("catEmptyTitle")}
                    subtitle={t("catEmptySubtitle")}
                  />
                )
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
              }
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* sticky bottom CTA */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: insets.bottom + spacing.md,
              backgroundColor: colors.bg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Button
              title={t("catOpenRequestCta")}
              icon="plus-circle-outline"
              onPress={() => router.push(`/create-booking?categoryId=${categoryId}`)}
            />
          </View>
        </>
      )}

      {/* pickers */}
      <PickerSheet
        visible={sheet === "city"}
        title={t("city")}
        options={cities.map((c) => ({ id: c.id, label: loc(c, "name") }))}
        selectedId={cityId}
        onSelect={(v) => setCityId(v as number | null)}
        onClose={() => setSheet(null)}
        searchable
        searchPlaceholder={t("searchCityPlaceholder")}
        allLabel={t("searchAllCities")}
      />
      <PickerSheet
        visible={sheet === "sort"}
        title={t("searchSort")}
        options={[
          { id: "rating", label: t("searchSortRating") },
          { id: "newest", label: t("searchSortNewest") },
        ]}
        selectedId={sort}
        onSelect={(v) => {
          if (v === "rating" || v === "newest") setSort(v);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}
