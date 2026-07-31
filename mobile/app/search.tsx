// Search — debounced pro search with city/category/availability/verified/sort filters.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { fetchCategories, fetchCities } from "../lib/refdata";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button, Chip, EmptyState, Loading, SectionHeader } from "../components/ui";
import { ProCard } from "../components/ProCard";
import type { Category, City, ProCard as ProCardType } from "../lib/types";

const PRO_SELECT =
  "*, profile:profiles!professionals_id_fkey!inner(*), professional_categories(category:categories(*)), city:cities(*)";
const PRO_SELECT_BY_CAT = PRO_SELECT + ", cat_filter:professional_categories!inner(category_id)";

/** icons come from the DB — never trust them blindly */
function safeIcon(icon?: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  return (icon && MaterialCommunityIcons.glyphMap[icon as keyof typeof MaterialCommunityIcons.glyphMap]
    ? icon
    : "tools") as keyof typeof MaterialCommunityIcons.glyphMap;
}

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

// ---------- bottom-sheet picker (city / category / sort) ----------
export function PickerSheet({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  searchable,
  searchPlaceholder,
  allLabel,
}: {
  visible: boolean;
  title: string;
  options: { id: number | string; label: string }[];
  selectedId: number | string | null;
  onSelect: (id: number | string | null) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  allLabel?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!visible) setQ("");
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = q.trim();
    if (!needle) return options;
    return options.filter((o) => o.label.includes(needle));
  }, [options, q]);

  const row = (label: string, active: boolean, onPress: () => void, key: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={{
        ...ROW,
        justifyContent: "space-between",
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text
        style={[
          RTL_TEXT,
          { color: active ? colors.brand : colors.text, fontSize: 15, fontWeight: active ? "800" : "500" },
        ]}
      >
        {label}
      </Text>
      {active ? <Ionicons name="checkmark" size={19} color={colors.brand} /> : null}
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            maxHeight: "70%",
            gap: spacing.md,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
            }}
          />
          <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>{title}</Text>
          {searchable ? (
            <View
              style={{
                ...ROW,
                gap: 8,
                backgroundColor: colors.chip,
                borderRadius: radius.full,
                paddingHorizontal: 14,
                paddingVertical: 9,
              }}
            >
              <Ionicons name="search" size={16} color={colors.faint} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.faint}
                style={[RTL_TEXT, { flex: 1, fontSize: 14, color: colors.text, padding: 0 }]}
              />
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(o) => String(o.id)}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              allLabel
                ? row(allLabel, selectedId === null, () => {
                    onSelect(null);
                    onClose();
                  }, "all")
                : null
            }
            renderItem={({ item }) =>
              row(item.label, selectedId === item.id, () => {
                onSelect(item.id);
                onClose();
              }, String(item.id))
            }
          />
        </View>
      </View>
    </Modal>
  );
}

export default function SearchScreen() {
  const { colors, shadows } = useTheme();
  const { t, loc } = useI18n();
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ categoryId?: string; q?: string }>();

  const [q, setQ] = useState(params.q ?? "");
  const [debouncedQ, setDebouncedQ] = useState(params.q ?? "");
  const [cityId, setCityId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(
    params.categoryId ? Number(params.categoryId) || null : null
  );
  const [availableOnly, setAvailableOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("rating");

  const [cities, setCities] = useState<City[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [rows, setRows] = useState<ProCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [sheet, setSheet] = useState<"city" | "category" | "sort" | null>(null);

  // debounce the text query 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    fetchCities().then(setCities).catch(() => {});
    fetchCategories().then(setCats).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setError(false);
      let query = supabase
        .from("professionals")
        .select(categoryId != null ? PRO_SELECT_BY_CAT : PRO_SELECT)
        .eq("profile.is_banned", false);
      if (categoryId != null) query = query.eq("cat_filter.category_id", categoryId);
      if (cityId != null) query = query.eq("city_id", cityId);
      if (availableOnly) query = query.eq("is_available", true);
      if (verifiedOnly) query = query.eq("verification_status", "approved");
      query =
        sort === "rating"
          ? query.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false })
          : query.order("created_at", { ascending: false });
      const { data, error: err } = await query.limit(100);
      if (err) throw err;
      setRows(((data as any[]) ?? []).map(mapPro));
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

  // free-text match applied client-side (covers business_name, bio and profile name in ar/he)
  const results = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((p) =>
      [p.business_name, p.bio, p.profile?.full_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [rows, debouncedQ]);

  if (authLoading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;

  // nothing typed + no filter → search doubles as a "browse all categories" screen
  const browsing =
    debouncedQ.trim().length === 0 &&
    q.trim().length === 0 &&
    cityId == null &&
    categoryId == null &&
    !availableOnly &&
    !verifiedOnly;

  const selectedCity = cityId != null ? cities.find((c) => c.id === cityId) : null;
  const selectedCat = categoryId != null ? cats.find((c) => c.id === categoryId) : null;

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
      key: "category",
      label: selectedCat ? loc(selectedCat, "name") : t("category"),
      active: categoryId != null,
      icon: "shape-outline",
      onPress: () => setSheet("category"),
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
      {/* header: back + search input */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
          ...ROW,
          gap: 10,
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
        <View
          style={{
            flex: 1,
            ...ROW,
            gap: 8,
            backgroundColor: colors.card,
            borderRadius: radius.full,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.card,
          }}
        >
          <Ionicons name="search" size={18} color={colors.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t("homeSearchPlaceholder")}
            placeholderTextColor={colors.faint}
            autoFocus
            returnKeyType="search"
            style={[RTL_TEXT, { flex: 1, fontSize: 14.5, color: colors.text, padding: 0 }]}
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.faint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* filter chips (inverted => starts from the right) */}
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

      {/* browse state — full category grid (search doubles as "all categories") */}
      {browsing ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, marginBottom: spacing.md }]}>
            {t("searchBrowseSubtitle")}
          </Text>
          <SectionHeader title={t("categories")} />
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: spacing.md }}>
            {cats.map((cat) => {
              const tileW = (width - spacing.lg * 2 - spacing.md * 3) / 4;
              return (
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
              );
            })}
          </View>
          {cats.length === 0 ? <EmptyState icon="shape-outline" title={t("noResults")} /> : null}
        </ScrollView>
      ) : loading ? (
        <Loading />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <ProCard pro={item} />}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
            flexGrow: 1,
          }}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, marginBottom: 2 }]}>
                {t("searchResultsCount", { count: results.length })}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            error ? (
              <View style={{ gap: spacing.md }}>
                <EmptyState icon="alert-circle-outline" title={t("error")} />
                <Button title={t("retry")} variant="outline" onPress={onRefresh} />
              </View>
            ) : (
              <EmptyState icon="magnify" title={t("noResults")} subtitle={t("searchEmptySubtitle")} />
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* pickers */}
      <PickerSheet
        visible={sheet === "city"}
        title={t("city")}
        options={cities.map((c) => ({ id: c.id, label: loc(c, "name") }))}
        selectedId={cityId}
        onSelect={(id) => setCityId(id as number | null)}
        onClose={() => setSheet(null)}
        searchable
        searchPlaceholder={t("searchCityPlaceholder")}
        allLabel={t("searchAllCities")}
      />
      <PickerSheet
        visible={sheet === "category"}
        title={t("category")}
        options={cats.map((c) => ({ id: c.id, label: loc(c, "name") }))}
        selectedId={categoryId}
        onSelect={(id) => setCategoryId(id as number | null)}
        onClose={() => setSheet(null)}
        allLabel={t("searchAllCategories")}
      />
      <PickerSheet
        visible={sheet === "sort"}
        title={t("searchSort")}
        options={[
          { id: "rating", label: t("searchSortRating") },
          { id: "newest", label: t("searchSortNewest") },
        ]}
        selectedId={sort}
        onSelect={(id) => {
          if (id === "rating" || id === "newest") setSort(id);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}
