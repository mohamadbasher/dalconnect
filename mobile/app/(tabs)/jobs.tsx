// Pro jobs tab — active / done / other segments over the pro's bookings.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { channelTopic } from "../../lib/realtime";
import { ROW } from "../../lib/rtl";
import { BookingCard } from "../../components/BookingCard";
import { Button, EmptyState, SkeletonList } from "../../components/ui";
import type { Booking, BookingStatus } from "../../lib/types";

type Segment = "active" | "done" | "other";

const SEGMENT_STATUSES: Record<Segment, BookingStatus[]> = {
  active: ["accepted", "on_the_way", "in_progress"],
  done: ["completed", "rated"],
  other: ["cancelled", "rejected"],
};

export default function JobsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { session, isPro, professional } = useAuth();
  const router = useRouter();
  const uid = session?.user?.id ?? null;

  const [segment, setSegment] = useState<Segment>("active");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const { data } = await supabase
        .from("bookings")
        .select("*, category:categories(*), customer:profiles!bookings_customer_id_fkey(*), city:cities(*)")
        .eq("professional_id", uid)
        .order("created_at", { ascending: false });
      setBookings((data as unknown as Booking[]) ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(channelTopic(`pro-jobs-${uid}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `professional_id=eq.${uid}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, load]);

  const visible = useMemo(
    () => bookings.filter((b) => SEGMENT_STATUSES[segment].includes(b.status)),
    [bookings, segment]
  );

  const counts = useMemo(() => {
    const c: Record<Segment, number> = { active: 0, done: 0, other: 0 };
    for (const b of bookings) {
      for (const s of Object.keys(SEGMENT_STATUSES) as Segment[]) {
        if (SEGMENT_STATUSES[s].includes(b.status)) c[s] += 1;
      }
    }
    return c;
  }, [bookings]);

  if (!isPro || !professional || !uid) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg }}>
        <EmptyState icon="briefcase-outline" title={t("proGateTitle")} subtitle={t("proGateSubtitle")} />
        <Button title={t("proGateCta")} icon="briefcase-plus" onPress={() => router.push("/become-pro")} />
      </View>
    );
  }

  if (loading) return <SkeletonList count={5} />;

  const segLabel: Record<Segment, string> = {
    active: t("proSegActive"),
    done: t("proSegDone"),
    other: t("segOther"),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ ...ROW, gap: 8, padding: spacing.lg, paddingBottom: spacing.sm }}>
        {(["active", "done", "other"] as Segment[]).map((s) => {
          const active = segment === s;
          return (
            <Pressable
              key={s}
              onPress={() => setSegment(s)}
              style={{
                ...ROW,
                gap: 6,
                backgroundColor: active ? colors.brand : colors.chip,
                borderRadius: radius.full,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: active ? colors.onBrand : colors.text, fontSize: 13, fontWeight: "600" }}>
                {segLabel[s]}
              </Text>
              {counts[s] > 0 ? (
                <View
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    paddingHorizontal: 5,
                    backgroundColor: active ? colors.card : colors.brandTint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.brand, fontSize: 11, fontWeight: "800" }}>{counts[s]}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={visible}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, flexGrow: 1 }}
        renderItem={({ item }) => <BookingCard booking={item} perspective="pro" href={`/job/${item.id}`} />}
        ListEmptyComponent={<EmptyState icon="hammer-wrench" title={t("noJobs")} subtitle={t("noJobsHint")} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      />
    </View>
  );
}
