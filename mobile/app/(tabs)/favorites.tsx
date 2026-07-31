// Customer favorites — saved professionals list (reached from the side menu).
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useTheme, spacing } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { Button, EmptyState, Loading } from "../../components/ui";
import { ProCard } from "../../components/ProCard";
import type { ProCard as ProCardType } from "../../lib/types";

const FAV_SELECT =
  "created_at, professional:professionals(*, profile:profiles!professionals_id_fkey(*), professional_categories(category:categories(*)), city:cities(*))";

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

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { session } = useAuth();

  const [pros, setPros] = useState<ProCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    try {
      setError(false);
      const { data, error: err } = await supabase
        .from("favorites")
        .select(FAV_SELECT)
        .eq("customer_id", session.user.id)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setPros(
        ((data as any[]) ?? [])
          .map((row) => row.professional)
          .filter(Boolean)
          .filter((p: any) => !p.profile?.is_banned)
          .map(mapPro)
      );
    } catch {
      setError(true);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // refetch on every focus — the tab stays mounted, so un-favoriting a pro on
  // their profile must reflect here the moment the user comes back.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!session) return null; // tabs layout redirects; safety guard
  if (loading) return <Loading />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, flexGrow: 1 }}
      data={pros}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <ProCard pro={item} />}
      ListEmptyComponent={
        error ? (
          <View style={{ gap: spacing.md }}>
            <EmptyState icon="alert-circle-outline" title={t("error")} />
            <Button title={t("retry")} variant="outline" onPress={onRefresh} />
          </View>
        ) : (
          <EmptyState icon="heart-outline" title={t("favEmptyTitle")} subtitle={t("favEmptySubtitle")} />
        )
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
