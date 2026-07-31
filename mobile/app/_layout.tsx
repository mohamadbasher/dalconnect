import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import {
  useFonts,
  Cairo_300Light,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from "@expo-google-fonts/cairo";
import {
  Rubik_300Light,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
  Rubik_800ExtraBold,
} from "@expo-google-fonts/rubik";
import { ThemeProvider, useTheme } from "../lib/theme";
import { I18nProvider } from "../lib/i18n";
import { AuthProvider } from "../context/AuthContext";
import { applyGlobalFont } from "../lib/font";
import { ensureLtrBase } from "../lib/rtl";
import { Loading } from "../components/ui";

ensureLtrBase();
applyGlobalFont();

function NotificationRouter() {
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.conversationId) router.push(`/chat/${data.conversationId}`);
      else if (data?.bookingId) router.push(`/booking/${data.bookingId}`);
    });
    return () => sub.remove();
  }, [router]);
  return null;
}

function Root() {
  const { colors, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <NotificationRouter />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_300Light,
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Rubik_300Light,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
    Rubik_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <Root />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
