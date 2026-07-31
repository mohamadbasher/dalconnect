// DalConnect design tokens — Dal look (terracotta + warm canvas), light & dark.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const light = {
  brand: "#c25d27",
  brandDark: "#a04c20",
  brandTint: "#fbf2eb",
  bg: "#faf7f4",
  card: "#ffffff",
  border: "#ece5dd",
  chip: "#f3eee8",
  text: "#1c1917",
  muted: "#78716c",
  faint: "#a8a29e",
  gold: "#f59e0b",
  goldTint: "#fef3c7",
  success: "#16a34a",
  successTint: "#dcfce7",
  danger: "#dc2626",
  dangerTint: "#fee2e2",
  warn: "#a16207",
  warnTint: "#fef9c3",
  info: "#2563eb",
  infoTint: "#dbeafe",
  overlay: "rgba(28,25,23,0.55)",
  tabInactive: "#a8a29e",
  onBrand: "#ffffff",
};

export const dark: typeof light = {
  brand: "#d96f38",
  brandDark: "#c25d27",
  brandTint: "#33241a",
  bg: "#171412",
  card: "#211d1a",
  border: "#36302a",
  chip: "#2a2521",
  text: "#f5f0eb",
  muted: "#b3aaa2",
  faint: "#8a817a",
  gold: "#fbbf24",
  goldTint: "#3a2f14",
  success: "#4ade80",
  successTint: "#14301d",
  danger: "#f87171",
  dangerTint: "#3a1a1a",
  warn: "#facc15",
  warnTint: "#332b10",
  info: "#60a5fa",
  infoTint: "#16233a",
  overlay: "rgba(0,0,0,0.6)",
  tabInactive: "#8a817a",
  onBrand: "#ffffff",
};

export type Palette = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, tile: 19, xl: 24, full: 999 } as const;

export const makeShadows = (c: Palette) => ({
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  float: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cta: {
    shadowColor: c.brand,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});

export type ThemeMode = "light" | "dark" | "system";
const MODE_KEY = "dalconnect.themeMode";

type ThemeCtx = {
  colors: Palette;
  dark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  shadows: ReturnType<typeof makeShadows>;
};

const Ctx = createContext<ThemeCtx>({
  colors: light,
  dark: false,
  mode: "system",
  setMode: () => {},
  shadows: makeShadows(light),
});

export function ThemeProvider({
  children,
  force,
}: {
  children: React.ReactNode;
  /** Pin the palette regardless of the user's setting (used pre-login). */
  force?: "light" | "dark";
}) {
  const system = useColorScheme();
  // Default to light; the user can switch to dark or system in settings.
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") setModeState(v);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
  };

  const isDark = force ? force === "dark" : mode === "system" ? system === "dark" : mode === "dark";
  const colors = isDark ? dark : light;
  const value = useMemo(
    () => ({ colors, dark: isDark, mode, setMode, shadows: makeShadows(colors) }),
    [isDark, mode, force]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

export const CURRENCY = "₪";
export const formatPrice = (n: number | string | null | undefined) => {
  if (n === null || n === undefined || n === "") return "";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return "";
  return `${CURRENCY}${num.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
};
