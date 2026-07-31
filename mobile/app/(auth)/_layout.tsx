import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "../../lib/theme";

// Pre-login screens are always light (white). Dark mode applies only after
// signing in, from the app's own theme setting.
export default function AuthLayout() {
  return (
    <ThemeProvider force="light">
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
