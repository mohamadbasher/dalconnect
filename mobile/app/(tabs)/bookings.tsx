// Customer bookings tab — segmented (active / done / cancelled) with realtime.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { ROW } from "../../lib/rtl";
import { BookingCard } from "../../components/BookingCard";
import { Button, EmptyState, Loading } from "../../components/ui";
import type { Booking, BookingStatus } from "../../lib/types";

type Segment = "active" | "done" | "cancelled";

const SEGMENT_STATUSES: Record<Segment, BookingStatus[]> = {
  active: ["open", "pending", "accepted", "on_the_way", "in_progress"],
  done: ["completed", "rated"],
  cancelled: ["cancelled", "rejected"],
};

const SEGMENTS: Segment[] = ["active", "done", "cancelled"];

/** segment chip with a count badge (Chip from ui.tsx has no badge slot) */
function SegChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        ...ROW,
        gap: 6,
        backgroundColor: active ? colors.brand : colors.chip,
        borderRadius: radius.full,
        paddingHorizontal: 14,
        paddingVertical: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: active ? colors.onBrand : colors.text, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <View
        style={{
          minWidth: 20,
          height: 20,
          paddingHorizontal: 5,
          borderRadius: 10,
          backgroundColor: active ? colors.brandDark : colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: active ? colors.onBrand : colors.muted, fontSize: 11, fontWeight: "700" }}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

export default function BookingsTab() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user.id;

  const [segment, setSegment] = useState<Segment>("active");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data, error } = await supabase
      .from("bookings")
      .select("*, category:categories(*), professional:professionals(*, profile:profiles!professionals_id_fkey(*))")
      .eq("customer_id", uid)
      .order("created_at", { ascending: false });
    if (!error) setBookings((data as unknown as Booking[]) ?? []);
    else setBookings((prev) => prev ?? []);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  // realtime: any change to my bookings → refetch
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`bookings-tab-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `customer_id=eq.${uid}` },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(
    () => (bookings ?? []).filter((b) => SEGMENT_STATUSES[segment].includes(b.status)),
    [bookings, segment]
  );

  const counts = useMemo(() => {
    const c: Record<Segment, number> = { active: 0, done: 0, cancelled: 0 };
    for (const b of bookings ?? []) {
      for (const seg of SEGMENTS) {
        if (SEGMENT_STATUSES[seg].includes(b.status)) c[seg] += 1;
      }
    }
    return c;
  }, [bookings]);

  if (bookings === null) return <Loading />;

  const segLabel: Record<Segment, string> = {
    active: t("segActive"),
    done: t("segDone"),
    cancelled: t("segCancelled"),
  };
  const emptyTitle =
    segment === "active" ? t("emptyBookingsTitle") : segment === "done" ? t("emptyDoneTitle") : t("emptyCancelledTitle");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ ...ROW, gap: 8, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        {SEGMENTS.map((seg) => (
          <SegChip
            key={seg}
            label={segLabel[seg]}
            count={counts[seg]}
            active={segment === seg}
            onPress={() => setSegment(seg)}
          />
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        renderItem={({ item }) => <BookingCard booking={item} perspective="customer" />}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: "center" }}>
            <EmptyState
              icon="clipboard-text-outline"
              title={emptyTitle}
              subtitle={segment === "active" ? t("emptyBookingsSubtitle") : undefined}
            />
            {segment === "active" ? (
              <Button
                title={t("newRequestCta")}
                icon="plus"
                onPress={() => router.push("/create-booking")}
                style={{ alignSelf: "center", minWidth: 200 }}
              />
            ) : null}
          </View>
        }
      />
    </View>
  );
}
