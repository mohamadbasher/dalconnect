import React, { useEffect, useState } from "react";
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
import { ToastProvider } from "../components/Toast";
import { NotificationsProvider } from "../context/NotificationsContext";
import { BrandSplash } from "../components/BrandSplash";

// Deterministic LTR base; screens lay out RTL explicitly.
ensureLtrBase();

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
  const [splashGone, setSplashGone] = useState(false);
  return (
    <>
      <StatusBar style={splashGone ? (dark ? "light" : "dark") : "light"} />
      <NotificationRouter />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      {/* Sibling above the stack: the animated splash covers the app while the
          first screen mounts behind it, then unmounts itself for good. */}
      {!splashGone && <BrandSplash onFinish={() => setSplashGone(true)} />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
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

  // Never block startup on the font: if it fails, boot with the system face.
  const ready = fontsLoaded || !!fontError;

  // expo-splash-screen is not a dependency here, so we can't hold the native
  // splash explicitly — but returning null keeps it on screen (Expo hides it
  // on the first rendered frame) instead of flashing an empty canvas.
  if (!ready) return null;

  // Route every Text/TextInput through the Cairo/Rubik family (weight-aware).
  // Skipped if the fonts failed, so we don't point at a missing family.
  if (fontsLoaded) applyGlobalFont();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <NotificationsProvider>
              <ToastProvider>
                <Root />
              </ToastProvider>
            </NotificationsProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
