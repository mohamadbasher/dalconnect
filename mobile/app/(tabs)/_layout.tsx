import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Tabs, Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme, radius } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { TopBar } from "../../components/TopBar";
import { Loading } from "../../components/ui";

/**
 * Center action: post a new request.
 *
 * It deliberately sits in the middle of the bar rather than at an edge — it is
 * the one thing every customer is here to do.
 */
function NewRequestButton() {
  const { colors, shadows } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Pressable
        onPress={() => router.push("/create-booking")}
        accessibilityRole="button"
        accessibilityLabel={t("tabUrgent")}
        hitSlop={8}
        style={({ pressed }) => ({
          top: -18,
          width: 62,
          height: 62,
          borderRadius: 31,
          backgroundColor: colors.brand,
          alignItems: "center",
          justifyContent: "center",
          // a ring in the bar's own colour so the button reads as floating
          borderWidth: 5,
          borderColor: colors.card,
          transform: [{ scale: pressed ? 0.93 : 1 }],
          ...shadows.cta,
        })}
      >
        <MaterialCommunityIcons name="plus" size={30} color="#ffffff" />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { colors, shadows } = useTheme();
  const { t } = useI18n();
  const { session, loading, mode } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;

  const proMode = mode === "pro";

  const icon =
    (name: keyof typeof Ionicons.glyphMap, focusedName: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <Ionicons name={focused ? focusedName : name} size={25} color={color} />
    );

  // Room for the labels plus whatever the phone reserves for its home indicator.
  const barHeight = 64 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        header: () => <TopBar />,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          height: barHeight,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          ...shadows.floatUp,
        },
        // NOTE: the bar is laid out left-to-right on purpose. Reversing it with
        // `flexDirection: row-reverse` moves the labels but NOT the touch
        // targets, so taps land on the wrong tab. The RTL order is achieved by
        // declaring the screens in reverse instead — see below.
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: "700", marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarHideOnKeyboard: Platform.OS === "android",
      }}
    >
      {/* Declared LEFT-to-RIGHT, so the list below reads as the mirror of what
          the user sees: the LAST entry is the right-most (primary) tab. */}

      {/* --- shared, left edge --- */}
      <Tabs.Screen
        name="profile"
        options={{ title: t("tabProfile"), tabBarIcon: icon("person-outline", "person") }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("tabChat"),
          tabBarIcon: icon("chatbubble-ellipses-outline", "chatbubble-ellipses"),
        }}
      />

      {/* --- professional --- */}
      <Tabs.Screen
        name="earnings"
        options={{
          title: t("tabEarnings"),
          tabBarIcon: icon("wallet-outline", "wallet"),
          href: proMode ? "/(tabs)/earnings" : null,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t("tabJobs"),
          tabBarIcon: icon("construct-outline", "construct"),
          href: proMode ? "/(tabs)/jobs" : null,
        }}
      />

      {/* --- customer: centre action --- */}
      <Tabs.Screen
        name="urgent"
        options={{
          title: "",
          tabBarItemStyle: proMode ? { display: "none" } : undefined,
          // `href` and `tabBarButton` are mutually exclusive in expo-router, so
          // this button does its own navigation.
          tabBarButton: () => (proMode ? null : <NewRequestButton />),
        }}
      />

      {/* --- right edge: the screen each role lands on --- */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tabDashboard"),
          tabBarIcon: icon("flash-outline", "flash"),
          href: proMode ? "/(tabs)/dashboard" : null,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t("tabBookings"),
          tabBarIcon: icon("clipboard-outline", "clipboard"),
          href: proMode ? null : "/(tabs)/bookings",
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabHome"),
          tabBarIcon: icon("home-outline", "home"),
          href: proMode ? null : "/(tabs)",
        }}
      />
    </Tabs>
  );
}
