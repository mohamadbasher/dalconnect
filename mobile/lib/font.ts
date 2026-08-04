// Global font: Cairo for Arabic UI, Rubik for Hebrew UI.
// Monkey-patches Text/TextInput render (Dal pattern) so every fontWeight maps
// to the right font cut without touching individual styles. RN can't fake-bold
// a custom font reliably, so each weight is its own file.
import React from "react";
import { Text, TextInput, StyleSheet, type TextStyle } from "react-native";

type Lang = "ar" | "he";
let currentLang: Lang = "ar";
export function setFontLang(l: Lang) {
  currentLang = l;
}

const CAIRO: Record<string, string> = {
  "100": "Cairo_300Light",
  "200": "Cairo_300Light",
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
  "100": "Rubik_300Light",
  "200": "Rubik_300Light",
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
  return map[weight ?? "400"] ?? map["400"]!;
}

let applied = false;
export function applyGlobalFont(): void {
  if (applied) return;
  applied = true;
  for (const Comp of [Text, TextInput] as any[]) {
    const origRender = Comp.render;
    if (!origRender) continue; // RN internals changed — fail safe, keep system font
    Comp.render = function (...args: any[]) {
      const el = origRender.apply(this, args);
      if (!el) return el;
      const flat = (StyleSheet.flatten(el.props.style) || {}) as TextStyle;
      // Respect an explicit fontFamily (icon fonts set their own cut).
      const fontFamily = flat.fontFamily ?? fontFor(flat.fontWeight ? String(flat.fontWeight) : undefined);
      // fontWeight MUST be dropped once a named cut is chosen: combining the two
      // makes Android synthesise a second bold on top of an already-bold face.
      // Setting it to undefined in the last style layer deletes it on flatten.
      const patch: TextStyle = { fontFamily, fontWeight: undefined };
      return React.cloneElement(el, { style: [el.props.style, patch] });
    };
  }
}
