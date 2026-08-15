// Dal-style top bar: brand-colored, rounded bottom corners, bell + title + menu.
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/theme";
import { useNotifications } from "../context/NotificationsContext";
import { ROW } from "../lib/rtl";
import { SideMenu } from "./SideMenu";

export function TopBar() {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // One shared subscription lives in the provider — this bar is mounted once
  // per tab screen, so it must never own a channel of its own.
  const { unread, clearUnread } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);

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

        {/* Row is reversed, so the FIRST child sits on the right. In an RTL
            interface the menu belongs on the start (right) side — which is also
            the edge the drawer slides in from. */}
        <View style={{ ...ROW, justifyContent: "space-between" }}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: pressed ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Ionicons name="menu" size={22} color="#fff" />
          </Pressable>

          <Pressable
            onPress={() => {
              // Opening the list IS "I've seen these" — the badge clears the
              // instant you tap, not after a network round trip finishes on
              // the next screen. The actual is_read write still happens on
              // notifications.tsx itself, so this stays correct no matter how
              // that screen was reached (bell, deep link, a push tap).
              clearUnread();
              router.push("/notifications");
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: pressed ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {unread > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -3,
                  left: -3,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.gold,
                  // a ring in the bar colour keeps the badge readable on orange
                  borderWidth: 1.5,
                  borderColor: colors.brand,
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
        </View>
      </View>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}
