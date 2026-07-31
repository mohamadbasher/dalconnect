// Dal-style top bar: brand-colored, rounded bottom corners, bell + title + menu.
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { ROW } from "../lib/rtl";
import { SideMenu } from "./SideMenu";

export function TopBar() {
  const { colors, shadows } = useTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    const load = () =>
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("is_read", false)
        .then(({ count }) => active && setUnread(count ?? 0));
    load();
    const channel = supabase
      .channel("topbar-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  return (
    <View
      style={{
        backgroundColor: colors.brand,
        paddingTop: insets.top + 8,
        paddingBottom: 14,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 22,
        ...shadows.float,
      }}
    >
      <View style={{ height: 38, justifyContent: "center" }}>
        {/* title stays perfectly centered regardless of the side icons' widths */}
        <Text
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            color: "#fff",
            fontSize: 19,
            fontWeight: "800",
            writingDirection: "ltr",
          }}
        >
          DalConnect
        </Text>

        <View style={{ ...ROW, justifyContent: "space-between" }}>
          {/* bell (visual right) */}
          <Pressable
            onPress={() => router.push("/notifications")}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {unread > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  minWidth: 17,
                  height: 17,
                  borderRadius: 9,
                  backgroundColor: colors.gold,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 3,
                }}
              >
                <Text style={{ color: "#1c1917", fontSize: 10, fontWeight: "800" }}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>

          {/* hamburger (visual left) */}
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="menu" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}
