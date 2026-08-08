import React from "react";
import { Pressable, View } from "react-native";
import { Tabs, Redirect, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { TopBar } from "../../components/TopBar";
import { Loading } from "../../components/ui";

// Center orange action button: shortcut to create an open ("urgent") request.
function UrgentTabButton() {
  const { colors, shadows } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Pressable
        onPress={() => router.push("/create-booking")}
        style={({ pressed }) => ({
          top: -16,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.brand,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 4,
          borderColor: colors.card,
          transform: [{ scale: pressed ? 0.94 : 1 }],
          ...shadows.cta,
        })}
      >
        <MaterialCommunityIcons name="flash" size={28} color="#ffffff" />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { colors, shadows } = useTheme();
  const { t } = useI18n();
  const { session, loading, mode } = useAuth();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;

  const proMode = mode === "pro";
  const icon =
    (name: keyof typeof Ionicons.glyphMap, focusedName: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused }: { color: string; focused: boolean }) =>
      <Ionicons name={focused ? focusedName : name} size={23} color={color} />;

  return (
    <Tabs
      screenOptions={{
        header: () => <TopBar />,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
          // The tab bar doesn't know about our manual RTL convention — reverse
          // it explicitly so the first tab (home) sits on the right, like the
          // rest of the RTL app.
          flexDirection: "row-reverse",
          ...shadows.float,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      {/* --- customer tabs (RTL: first declared = rightmost) --- */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabHome"),
          tabBarIcon: icon("home-outline", "home"),
          href: proMode ? null : "/(tabs)",
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
      {/* center urgent-request action (customer only) */}
      <Tabs.Screen
        name="urgent"
        options={{
          title: "",
          tabBarButton: (props) => (proMode ? null : <UrgentTabButton />),
          href: proMode ? null : "/(tabs)/urgent",
        }}
      />

      {/* --- professional tabs --- */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tabDashboard"),
          tabBarIcon: icon("flash-outline", "flash"),
          href: proMode ? "/(tabs)/dashboard" : null,
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
      <Tabs.Screen
        name="earnings"
        options={{
          title: t("tabEarnings"),
          tabBarIcon: icon("wallet-outline", "wallet"),
          href: proMode ? "/(tabs)/earnings" : null,
        }}
      />

      {/* --- shared tabs --- */}
      <Tabs.Screen
        name="chat"
        options={{
          title: t("tabChat"),
          tabBarIcon: icon("chatbubble-ellipses-outline", "chatbubble-ellipses"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabProfile"),
          tabBarIcon: icon("person-outline", "person"),
        }}
      />
    </Tabs>
  );
}
