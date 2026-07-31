// Global font: Cairo for Arabic UI, Rubik for Hebrew UI.
// Monkey-patches Text/TextInput render (Dal pattern) so every fontWeight maps
// to the right font cut without touching individual styles.
import { Text, TextInput, StyleSheet } from "react-native";

type Lang = "ar" | "he";
let currentLang: Lang = "ar";
export function setFontLang(l: Lang) {
  currentLang = l;
}

const CAIRO: Record<string, string> = {
  "300": "Cairo_300Light",
  "400": "Cairo_400Regular",
  "500": "Cairo_600SemiBold",
  "600": "Cairo_600SemiBold",
  "700": "Cairo_700Bold",
  "800": "Cairo_800ExtraBold",
  "900": "Cairo_800ExtraBold",
  normal: "Cairo_400Regular",
  bold: "Cairo_700Bold",
};
const RUBIK: Record<string, string> = {
  "300": "Rubik_300Light",
  "400": "Rubik_400Regular",
  "500": "Rubik_500Medium",
  "600": "Rubik_600SemiBold",
  "700": "Rubik_700Bold",
  "800": "Rubik_800ExtraBold",
  "900": "Rubik_800ExtraBold",
  normal: "Rubik_400Regular",
  bold: "Rubik_700Bold",
};

function fontFor(weight: string | undefined): string {
  const map = currentLang === "he" ? RUBIK : CAIRO;
  return map[weight ?? "400"] ?? map["400"];
}

let applied = false;
export function applyGlobalFont() {
  if (applied) return;
  applied = true;
  for (const Comp of [Text, TextInput] as any[]) {
    const origRender = Comp.render;
    if (!origRender) continue;
    Comp.render = function (...args: any[]) {
      const el = origRender.apply(this, args);
      if (!el) return el;
      const flat = StyleSheet.flatten(el.props.style) || {};
      const weight = flat.fontWeight ? String(flat.fontWeight) : undefined;
      const fontFamily = flat.fontFamily ?? fontFor(weight);
      return React.cloneElement(el, {
        style: [el.props.style, { fontFamily, fontWeight: undefined }],
      });
    };
  }
}

import React from "react";
