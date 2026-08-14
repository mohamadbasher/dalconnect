// Conversation thread — realtime messages, typing indicator, read receipts,
// text / image / location messages.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker } from "react-native-maps";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { channelTopic } from "../../lib/realtime";
import { useTheme, radius, spacing } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { ROW, RTL_TEXT, RTL_INPUT } from "../../lib/rtl";
import { Avatar, EmptyState, Loading } from "../../components/ui";
import { formatTime } from "../../lib/format";
import { uploadImage } from "../../lib/upload";
import { getCurrentPosition } from "../../lib/location";
import type { Conversation, Message, Profile } from "../../lib/types";

const PAGE = 40;
const CONVO_SELECT =
  "*, customer:profiles!conversations_customer_id_fkey(*), professional:profiles!conversations_professional_id_fkey(*)";

/** message + client-only flags for optimistic/failed sends */
type LocalMessage = Message & { failed?: boolean; localUri?: string };

const sortDesc = <T extends Message>(arr: T[]): T[] =>
  [...arr].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

// ---------- animated "typing…" dots ----------
function TypingDots({ color }: { color: string }) {
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;
  const d3 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 280, useNativeDriver: true }),
        ])
      );
    const anims = [mk(d1, 0), mk(d2, 140), mk(d3, 280)];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [d1, d2, d3]);
  return (
    <View style={{ ...ROW, gap: 3 }}>
      {[d1, d2, d3].map((v, i) => (
        <Animated.View
          key={i}
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: v }}
        />
      ))}
    </View>
  );
}

export default function ChatThread() {
  const params = useLocalSearchParams<{ id: string }>();
  const convoId = String(params.id ?? "");
  const { colors, shadows } = useTheme();
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = session?.user.id;

  const [convo, setConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [sendingMedia, setSendingMedia] = useState(false);
  const [typingVisible, setTypingVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const mounted = useRef(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const otherIdRef = useRef<string | null>(null);
  const tmpSeq = useRef(0);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  const other: Profile | null = useMemo(() => {
    if (!convo || !uid) return null;
    return (convo.customer_id === uid ? convo.professional : convo.customer) ?? null;
  }, [convo, uid]);

  // ---------- helpers ----------
  const upsertMessage = useCallback((row: LocalMessage, replaceTempId?: string) => {
    setMessages((prev) => {
      const base = replaceTempId ? prev.filter((m) => m.id !== replaceTempId) : prev;
      if (base.some((m) => m.id === row.id)) return base === prev ? prev : base;
      return sortDesc([row, ...base]);
    });
  }, []);

  const setFailed = useCallback((tempId: string, failed: boolean) => {
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed } : m)));
  }, []);

  const markRead = useCallback(async () => {
    const otherId = otherIdRef.current;
    if (!otherId || !convoId) return;
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", convoId)
      .eq("sender_id", otherId)
      .eq("is_read", false);
  }, [convoId]);

  // ---------- initial load ----------
  useEffect(() => {
    if (!convoId || !uid) return;
    let active = true;
    (async () => {
      const [{ data: c }, { data: msgs }] = await Promise.all([
        supabase.from("conversations").select(CONVO_SELECT).eq("id", convoId).maybeSingle(),
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", convoId)
          .order("created_at", { ascending: false })
          .limit(PAGE),
      ]);
      if (!active || !mounted.current) return;
      const conversation = (c as Conversation | null) ?? null;
      setConvo(conversation);
      if (conversation) {
        otherIdRef.current =
          conversation.customer_id === uid ? conversation.professional_id : conversation.customer_id;
      }
      const rows = (msgs ?? []) as Message[];
      setMessages(rows);
      setHasMore(rows.length === PAGE);
      setLoading(false);
      markRead();
    })();
    return () => {
      active = false;
    };
  }, [convoId, uid, markRead]);

  // mark incoming messages read whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      markRead();
    }, [markRead])
  );

  // ---------- realtime: messages + typing broadcast on one channel ----------
  useEffect(() => {
    if (!convoId || !uid) return;
    const channel = supabase
      .channel(channelTopic(`chat-${convoId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convoId}` },
        (payload) => {
          if (!mounted.current) return;
          const row = payload.new as Message;
          upsertMessage(row);
          if (row.sender_id !== uid) {
            setTypingVisible(false);
            markRead();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${convoId}` },
        (payload) => {
          if (!mounted.current) return;
          const row = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!mounted.current) return;
        if (payload?.userId && payload.userId !== uid) {
          setTypingVisible(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => {
            if (mounted.current) setTypingVisible(false);
          }, 3000);
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [convoId, uid, upsertMessage, markRead]);

  // ---------- pagination ----------
  const loadOlder = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[messages.length - 1];
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convoId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (!mounted.current) return;
    const rows = (data ?? []) as Message[];
    setMessages((prev) => sortDesc([...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]));
    setHasMore(rows.length === PAGE);
    setLoadingMore(false);
  };

  // ---------- typing broadcast (throttled to every 2s while typing) ----------
  const onChangeText = (v: string) => {
    setText(v);
    const now = Date.now();
    if (v.trim().length > 0 && uid && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      void channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: uid },
      });
    }
  };

  // ---------- senders ----------
  const makeTemp = (partial: Partial<LocalMessage>): LocalMessage => ({
    id: `tmp-${++tmpSeq.current}`,
    conversation_id: convoId,
    sender_id: uid ?? "",
    type: "text",
    body: "",
    image_url: null,
    lat: null,
    lng: null,
    is_read: false,
    created_at: new Date().toISOString(),
    ...partial,
  });

  /** insert a temp message into the DB; on failure keep the bubble marked failed */
  const insertTemp = useCallback(
    async (temp: LocalMessage) => {
      if (!uid) return;
      try {
        const payload: Record<string, unknown> = {
          conversation_id: convoId,
          sender_id: uid,
          type: temp.type,
        };
        if (temp.type === "text") {
          payload.body = temp.body;
        } else if (temp.type === "location") {
          payload.lat = temp.lat;
          payload.lng = temp.lng;
        } else {
          // image: upload first if we still only have the local file
          let url = temp.image_url;
          if (temp.localUri && !(url ?? "").startsWith("http")) {
            url = await uploadImage({
              bucket: "chat-images",
              userId: uid,
              localUri: temp.localUri,
              fileName: `${Date.now()}.jpg`,
            });
          }
          payload.image_url = url;
        }
        const { data, error } = await supabase.from("messages").insert(payload).select("*").single();
        if (error || !data) throw error ?? new Error("insert failed");
        if (mounted.current) upsertMessage(data as Message, temp.id);
      } catch {
        if (mounted.current) setFailed(temp.id, true);
      }
    },
    [convoId, uid, upsertMessage, setFailed]
  );

  /** tap / long-press on a failed bubble → retry or discard */
  const onFailedPress = (m: LocalMessage) => {
    Alert.alert(t("chatSendFailed"), t("chatFailedBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => setMessages((prev) => prev.filter((x) => x.id !== m.id)),
      },
      {
        text: t("retry"),
        onPress: () => {
          setFailed(m.id, false);
          void insertTemp(m);
        },
      },
    ]);
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body || !uid) return;
    setText("");
    const temp = makeTemp({ type: "text", body });
    upsertMessage(temp);
    await insertTemp(temp);
  };

  const sendImage = async () => {
    if (!uid || sendingMedia) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const localUri = res.assets[0].uri;
    setSendingMedia(true);
    const temp = makeTemp({ type: "image", image_url: localUri, localUri });
    upsertMessage(temp);
    try {
      await insertTemp(temp);
    } finally {
      if (mounted.current) setSendingMedia(false);
    }
  };

  const sendLocation = async () => {
    if (!uid || sendingMedia) return;
    setSendingMedia(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) {
        Alert.alert(t("chatLocationFailed"));
        return;
      }
      const temp = makeTemp({ type: "location", lat: pos.lat, lng: pos.lng });
      upsertMessage(temp);
      await insertTemp(temp);
    } finally {
      if (mounted.current) setSendingMedia(false);
    }
  };

  // ---------- header actions ----------
  const openProfile = () => {
    if (convo && other && other.id === convo.professional_id) {
      router.push(`/pro/${other.id}`);
    }
  };

  // ---------- bubble ----------
  const renderItem = ({ item, index }: { item: LocalMessage; index: number }) => {
    const mine = item.sender_id === uid;
    // in the inverted list, index-1 is the visually-adjacent NEWER message
    const newer = index > 0 ? messages[index - 1] : null;
    const tight = !!newer && newer.sender_id === item.sender_id;
    const isMedia = item.type !== "text";
    const failed = !!item.failed;
    const pending = item.id.startsWith("tmp-") && !failed;

    let content: React.ReactNode = null;
    if (item.type === "text") {
      content = (
        <Text
          style={[
            RTL_TEXT,
            { color: mine ? colors.onBrand : colors.text, fontSize: 15, lineHeight: 21 },
          ]}
        >
          {item.body}
        </Text>
      );
    } else if (item.type === "image") {
      content = (
        <Pressable
          onPress={() =>
            failed ? onFailedPress(item) : item.image_url && setViewerUri(item.image_url)
          }
        >
          <Image
            source={{ uri: item.image_url ?? undefined }}
            style={{ width: 200, height: 200, borderRadius: radius.md, backgroundColor: colors.chip }}
            contentFit="cover"
          />
        </Pressable>
      );
    } else {
      const lat = item.lat ?? 0;
      const lng = item.lng ?? 0;
      content = (
        <Pressable
          onPress={() =>
            failed
              ? onFailedPress(item)
              : Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {})
          }
        >
          <View
            pointerEvents="none"
            style={{ width: 200, height: 120, borderRadius: radius.md, overflow: "hidden" }}
          >
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              liteMode
            >
              <Marker coordinate={{ latitude: lat, longitude: lng }} />
            </MapView>
          </View>
          <Text
            style={{
              color: mine ? colors.onBrand : colors.muted,
              fontSize: 12,
              textAlign: "center",
              paddingTop: 4,
            }}
          >
            {t("chatSharedLocation")}
          </Text>
        </Pressable>
      );
    }

    return (
      <Pressable
        disabled={!(mine && failed)}
        onPress={() => onFailedPress(item)}
        onLongPress={() => onFailedPress(item)}
        style={{
          // RTL mirror: my messages sit on the left, theirs on the right
          alignSelf: mine ? "flex-start" : "flex-end",
          alignItems: mine ? "flex-start" : "flex-end",
          maxWidth: "78%",
          marginBottom: tight ? 2 : 6,
        }}
      >
        <View
          style={[
            {
              backgroundColor: mine ? colors.brand : colors.card,
              borderRadius: 16,
              borderBottomLeftRadius: mine ? 4 : 16,
              borderBottomRightRadius: mine ? 16 : 4,
              paddingHorizontal: isMedia ? 4 : 12,
              paddingVertical: isMedia ? 4 : 8,
              opacity: failed ? 0.65 : 1,
            },
            mine ? null : shadows.card,
          ]}
        >
          {content}
        </View>
        {failed ? (
          <View style={{ ...ROW, gap: 3, marginTop: 2, paddingHorizontal: 2 }}>
            <Ionicons name="alert-circle" size={13} color={colors.danger} />
            <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 10, fontWeight: "700" }]}>
              {t("chatTapToRetry")}
            </Text>
          </View>
        ) : (
          <View style={{ ...ROW, gap: 3, marginTop: 2, paddingHorizontal: 2 }}>
            <Text style={{ color: colors.faint, fontSize: 10 }}>
              {formatTime(item.created_at, lang)}
            </Text>
            {mine ? (
              <Ionicons
                name={pending ? "time-outline" : item.is_read ? "checkmark-done" : "checkmark"}
                size={13}
                color={!pending && item.is_read ? colors.info : colors.faint}
              />
            ) : null}
          </View>
        )}
      </Pressable>
    );
  };

  // ---------- screen states ----------
  if (loading) return <Loading />;

  const header = (
    <View
      style={{
        ...ROW,
        gap: spacing.md,
        paddingTop: insets.top + 6,
        paddingBottom: 10,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
        <Ionicons name="arrow-forward" size={24} color={colors.text} />
      </Pressable>
      <Pressable onPress={openProfile} style={{ ...ROW, gap: spacing.sm, flex: 1 }}>
        <Avatar uri={other?.avatar_url} name={other?.full_name} size={38} />
        <Text
          numberOfLines={1}
          style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800", flex: 1 }]}
        >
          {other?.full_name || "؟"}
        </Text>
      </Pressable>
    </View>
  );

  if (!convo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <EmptyState icon="chat-remove-outline" title={t("chatNotFound")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {header}

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        inverted
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: spacing.md }}>
              <ActivityIndicator size="small" color={colors.brand} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          // inverted lists render the empty component upside down — flip it back
          <View style={{ flex: 1, justifyContent: "center", transform: [{ scaleY: -1 }] }}>
            <EmptyState
              icon="chat-processing-outline"
              title={t("chatSayHello")}
              subtitle={t("chatSayHelloSubtitle")}
            />
          </View>
        }
      />

      {typingVisible ? (
        <View style={{ ...ROW, gap: 6, paddingHorizontal: spacing.lg, paddingBottom: 4 }}>
          <TypingDots color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>{t("chatTyping")}</Text>
        </View>
      ) : null}

      {/* composer */}
      <View
        style={{
          ...ROW,
          alignItems: "flex-end",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={sendImage}
          disabled={sendingMedia}
          hitSlop={6}
          style={{ padding: 8, opacity: sendingMedia ? 0.4 : 1 }}
        >
          {sendingMedia ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Ionicons name="image-outline" size={23} color={colors.muted} />
          )}
        </Pressable>
        <Pressable
          onPress={sendLocation}
          disabled={sendingMedia}
          hitSlop={6}
          style={{ padding: 8, opacity: sendingMedia ? 0.4 : 1 }}
        >
          <Ionicons name="location-outline" size={23} color={colors.muted} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder={t("chatInputPlaceholder")}
          placeholderTextColor={colors.faint}
          multiline
          style={[
            RTL_INPUT,
            {
              flex: 1,
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 22,
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 10,
              fontSize: 15,
              color: colors.text,
              minHeight: 42,
              maxHeight: 100, // ~4 lines
            },
          ]}
        />
        <Pressable
          onPress={sendText}
          disabled={!text.trim()}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: radius.full,
            backgroundColor: colors.brand,
            alignItems: "center",
            justifyContent: "center",
            opacity: !text.trim() ? 0.4 : pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          {/* RTL: flip the send arrow to point in the reading direction */}
          <Ionicons
            name="send"
            size={18}
            color={colors.onBrand}
            style={{ transform: [{ scaleX: -1 }] }}
          />
        </Pressable>
      </View>

      {/* fullscreen image viewer */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.overlay }}>
          <View style={{ flex: 1, backgroundColor: colors.overlay }}>
            <Pressable
              onPress={() => setViewerUri(null)}
              hitSlop={10}
              style={{
                position: "absolute",
                top: insets.top + 10,
                left: spacing.lg,
                zIndex: 2,
                padding: 8,
                borderRadius: radius.full,
                backgroundColor: colors.overlay,
              }}
            >
              <Ionicons name="close" size={26} color={colors.onBrand} />
            </Pressable>
            {viewerUri ? (
              <Image source={{ uri: viewerUri }} style={{ flex: 1 }} contentFit="contain" />
            ) : null}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
