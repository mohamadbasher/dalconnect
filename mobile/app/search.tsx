// Service finder — customers search the trade they need, not the person.
// Picking a service starts a request; there is no professional directory.
//
// One input, one result surface. Nothing else competes with the search field.
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
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { fetchCategories } from "../lib/refdata";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button, EmptyState, Loading, SheetHandle, SkeletonList, pressCard } from "../components/ui";
import type { Category } from "../lib/types";

/** icons come from the DB — never trust them blindly */
function safeIcon(icon?: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  return (icon && MaterialCommunityIcons.glyphMap[icon as keyof typeof MaterialCommunityIcons.glyphMap]
    ? icon
    : "tools") as keyof typeof MaterialCommunityIcons.glyphMap;
}

// ---------- bottom-sheet picker (city / category / sort) ----------
// Generic bottom-sheet picker. Currently unmounted anywhere (the pro directory
// it used to filter is gone) — kept as a shared export for future pickers.
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
        borderBottomColor: colors.hairline,
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
          <SheetHandle />
          <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>{title}</Text>
          {searchable ? (
            <View
              style={{
                ...ROW,
                gap: spacing.sm,
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
  const params = useLocalSearchParams<{ q?: string }>();

  const [q, setQ] = useState(params.q ?? "");
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      setError(false);
      setCats(await fetchCategories(force));
    } catch {
      setCats([]);
      setError(true);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const needle = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return cats;
    return cats.filter((c) =>
      [c.name_ar, c.name_he, c.slug].join(" ").toLowerCase().includes(needle)
    );
  }, [cats, needle]);

  const start = (categoryId: number) => router.push(`/create-booking?categoryId=${categoryId}`);

  if (authLoading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;

  const tileW = (width - spacing.lg * 2 - spacing.md * 3) / 4;

  const tile = (cat: Category) => (
    <Pressable
      key={cat.id}
      onPress={() => start(cat.id)}
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
      {/* fixed two-line height so every row of tiles lines up */}
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
  );

  const resultRow = (cat: Category) => (
    <Pressable
      key={cat.id}
      onPress={() => start(cat.id)}
      style={({ pressed }) => [
        {
          ...ROW,
          gap: spacing.md,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.md,
          ...shadows.card,
        },
        pressed ? pressCard : null,
      ]}
    >
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
        <MaterialCommunityIcons name={safeIcon(cat.icon)} size={22} color={colors.brand} />
      </View>
      <Text numberOfLines={1} style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
        {loc(cat, "name")}
      </Text>
      {/* last child = visual left; "chevron-back" points left = forward in RTL */}
      <Ionicons name="chevron-back" size={16} color={colors.faint} />
    </Pressable>
  );

  const refresh = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
  );

  const body = () => {
    if (loading) return <SkeletonList count={4} />;

    if (error) {
      return (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.md }}
          refreshControl={refresh}
        >
          <EmptyState icon="cloud-off-outline" title={t("searchErrorTitle")} subtitle={t("searchErrorSubtitle")} />
          <Button title={t("retry")} icon="refresh" onPress={onRefresh} />
        </ScrollView>
      );
    }

    // nothing typed → the whole catalogue as a grid, no headings competing
    if (!needle) {
      return (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.xl,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refresh}
        >
          {cats.length === 0 ? (
            <EmptyState icon="shape-outline" title={t("homeNoServices")} />
          ) : (
            <View
              style={{
                flexDirection: "row-reverse", // fills from the right
                flexWrap: "wrap",
                alignItems: "flex-start",
                columnGap: spacing.md,
                rowGap: spacing.lg,
              }}
            >
              {cats.map(tile)}
            </View>
          )}
        </ScrollView>
      );
    }

    // a query → matching services as rows
    return (
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.md,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
      >
        {results.length > 0 ? (
          <>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5 }]}>
              {t("searchServicesCount", { count: results.length })}
            </Text>
            {results.map(resultRow)}
          </>
        ) : (
          <View style={{ flex: 1, justifyContent: "center", gap: spacing.md }}>
            <EmptyState
              icon="magnify-close"
              title={t("searchNoServiceTitle")}
              subtitle={t("searchNoServiceSubtitle")}
            />
            <Button title={t("searchClearQuery")} variant="outline" onPress={() => setQ("")} />
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header: back (visual right) + the one input */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          ...ROW,
          gap: spacing.sm,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [
            {
              width: 40,
              height: 40,
              borderRadius: radius.full,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
              ...shadows.card,
            },
            pressed ? pressCard : null,
          ]}
        >
          {/* RTL back points right */}
          <Ionicons name="arrow-forward" size={20} color={colors.text} />
        </Pressable>

        <View
          style={{
            flex: 1,
            ...ROW,
            gap: spacing.sm,
            backgroundColor: colors.card,
            borderRadius: radius.full,
            paddingHorizontal: spacing.lg,
            paddingVertical: 10,
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

      {body()}
    </View>
  );
}
