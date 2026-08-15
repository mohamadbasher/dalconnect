// Conversations list — customer <-> professional chats, realtime refreshed.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { channelTopic } from "../../lib/realtime";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Avatar, EmptyState, Loading } from "../../components/ui";
import { formatTime } from "../../lib/format";
import type { Conversation, Profile } from "../../lib/types";
import { PROFILE_FIELDS } from "../../lib/queries";

const CONVO_SELECT =
  `*, customer:profiles!conversations_customer_id_fkey(${PROFILE_FIELDS}), professional:profiles!conversations_professional_id_fkey(${PROFILE_FIELDS})`;

export default function ChatTab() {
  const { colors, shadows } = useTheme();
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const { data } = await supabase
        .from("conversations")
        .select(CONVO_SELECT)
        .or(`customer_id.eq.${uid},professional_id.eq.${uid}`)
        .order("last_message_at", { ascending: false });
      const rows = (data ?? []) as Conversation[];

      // unread counts: one query on messages, counted client-side
      const counts: Record<string, number> = {};
      if (rows.length > 0) {
        const { data: unreadRows } = await supabase
          .from("messages")
          .select("conversation_id")
          .in(
            "conversation_id",
            rows.map((r) => r.id)
          )
          .eq("is_read", false)
          .neq("sender_id", uid);
        for (const m of (unreadRows ?? []) as { conversation_id: string }[]) {
          counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1;
        }
      }

      if (!mounted.current) return;
      setConversations(rows);
      setUnread(counts);
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  // refresh unread state when returning from a thread
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // realtime: any change on conversations (RLS scopes to mine) -> refetch
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(channelTopic("conversations-list"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) return <Loading />;

  const renderRow = ({ item }: { item: Conversation }) => {
    const other: Profile | undefined =
      item.customer_id === uid ? item.professional : item.customer;
    const count = unread[item.id] ?? 0;
    const hasUnread = count > 0;
    return (
      <Pressable
        onPress={() => router.push(`/chat/${item.id}`)}
        style={({ pressed }) => [
          {
            ...ROW,
            gap: spacing.md,
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            padding: spacing.md,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
          shadows.card,
        ]}
      >
        <Avatar uri={other?.avatar_url} name={other?.full_name} size={50} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={[
              RTL_TEXT,
              { color: colors.text, fontSize: 15.5, fontWeight: hasUnread ? "800" : "700" },
            ]}
          >
            {other?.full_name || "؟"}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              RTL_TEXT,
              {
                color: hasUnread ? colors.text : colors.muted,
                fontSize: 13,
                fontWeight: hasUnread ? "600" : "400",
              },
            ]}
          >
            {item.last_message_preview || t("chatStartConversation")}
          </Text>
        </View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ color: hasUnread ? colors.brand : colors.faint, fontSize: 11, fontWeight: "600" }}>
            {formatTime(item.last_message_at, lang)}
          </Text>
          {hasUnread ? (
            <View
              style={{
                minWidth: 19,
                height: 19,
                borderRadius: radius.full,
                backgroundColor: colors.brand,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 5,
              }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 10.5, fontWeight: "800" }}>
                {count > 99 ? "99+" : count}
              </Text>
            </View>
          ) : (
            <View style={{ height: 19 }} />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chat-outline"
            title={t("chatEmptyTitle")}
            subtitle={t("chatEmptySubtitle")}
          />
        }
      />
    </View>
  );
}
