// Notifications — list, mark read, realtime prepend, deep-link routing by payload.
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { formatTime } from "../lib/format";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { EmptyState, Loading } from "../components/ui";
import { notificationText } from "../lib/types";
import type { Notification } from "../lib/types";

const TYPE_ICON: Record<Notification["type"], keyof typeof Ionicons.glyphMap> = {
  booking_update: "clipboard-outline",
  offer: "pricetag-outline",
  message: "chatbubble-outline",
  system: "megaphone-outline",
  promo: "megaphone-outline",
};

export default function NotificationsScreen() {
  const { colors, shadows } = useTheme();
  const { t, lang } = useI18n();
  const { session, mode } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = session?.user?.id;

  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data, error: err } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    if (err) {
      setError(true);
    } else {
      setError(false);
      setItems((data as Notification[]) ?? []);
    }
  }, [uid]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // realtime: prepend new notifications
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel("notifications-screen")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as Notification;
          setItems((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const markAllRead = async () => {
    if (!uid) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error: err } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", uid)
      .eq("is_read", false);
    if (err) load(); // resync optimistic state if the write failed
  };

  const openNotification = (n: Notification) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      supabase.from("notifications").update({ is_read: true }).eq("id", n.id).then(() => {});
    }
    if (n.data?.conversationId) {
      router.push(`/chat/${n.data.conversationId}`);
    } else if (n.data?.bookingId) {
      router.push(mode === "pro" ? `/job/${n.data.bookingId}` : `/booking/${n.data.bookingId}`);
    }
  };

  const hasUnread = items.some((n) => !n.is_read);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header */}
      <View
        style={{
          ...ROW,
          gap: spacing.md,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
          {t("notifications")}
        </Text>
        {hasUnread ? (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "700" }}>{t("notifMarkAllRead")}</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          ListEmptyComponent={
            error ? (
              <EmptyState icon="alert-circle-outline" title={t("error")} />
            ) : (
              <EmptyState icon="bell-outline" title={t("notifEmptyTitle")} subtitle={t("notifEmptySubtitle")} />
            )
          }
          renderItem={({ item }) => {
            const tappable = Boolean(item.data?.conversationId || item.data?.bookingId) || !item.is_read;
            return (
              <Pressable
                onPress={() => openNotification(item)}
                disabled={!tappable}
                style={({ pressed }) => [
                  {
                    ...ROW,
                    alignItems: "flex-start",
                    gap: spacing.md,
                    backgroundColor: item.is_read ? colors.card : colors.brandTint,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                  shadows.card,
                ]}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: item.is_read ? colors.brandTint : colors.card,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={TYPE_ICON[item.type] ?? "megaphone-outline"} size={19} color={colors.brand} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={[
                      RTL_TEXT,
                      { color: colors.text, fontSize: 14.5, fontWeight: item.is_read ? "600" : "800" },
                    ]}
                    numberOfLines={2}
                  >
                    {notificationText(item, lang).title}
                  </Text>
                  {notificationText(item, lang).body ? (
                    <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]} numberOfLines={2}>
                      {notificationText(item, lang).body}
                    </Text>
                  ) : null}
                  <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 11.5 }]}>
                    {formatTime(item.created_at, lang)}
                  </Text>
                </View>
                {!item.is_read ? (
                  <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand, marginTop: 6 }} />
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
