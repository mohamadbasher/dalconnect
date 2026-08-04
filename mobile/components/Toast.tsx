// Lightweight toast/snackbar system — replaces blocking Alert.alert() for
// success/info/error feedback. Alerts stay only for real confirmations.
//
// Usage:  const toast = useToast();  toast.success(t("saved"));
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, radius, spacing } from "../lib/theme";
import { ROW, RTL_TEXT } from "../lib/rtl";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastCtx = {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const Ctx = createContext<ToastCtx>({
  show: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
});

const DURATION = 2800;

function ToastView({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      onDone(item.id)
    );
  }, [anim, item.id, onDone]);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();
    timer.current = setTimeout(hide, DURATION);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [anim, hide]);

  const tone =
    item.kind === "success"
      ? { bg: colors.success, icon: "checkmark-circle" as const }
      : item.kind === "error"
        ? { bg: colors.danger, icon: "alert-circle" as const }
        : { bg: colors.text, icon: "information-circle" as const };

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
        marginBottom: spacing.sm,
      }}
    >
      <Pressable
        onPress={hide}
        style={{
          ...ROW,
          gap: spacing.sm,
          backgroundColor: tone.bg,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: spacing.lg,
          ...shadows.float,
        }}
      >
        <Ionicons name={tone.icon} size={20} color="#ffffff" />
        <Text
          numberOfLines={3}
          style={[RTL_TEXT, { flex: 1, color: "#ffffff", fontSize: 14, fontWeight: "700" }]}
        >
          {item.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();
  const nextId = useRef(1);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    if (!message) return;
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    if (kind === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (kind === "error") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const value = React.useMemo<ToastCtx>(
    () => ({
      show,
      success: (m: string) => show(m, "success"),
      error: (m: string) => show(m, "error"),
      info: (m: string) => show(m, "info"),
    }),
    [show]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          bottom: insets.bottom + 76, // clears the tab bar
        }}
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDone={remove} />
        ))}
      </View>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
