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

// Neither brand face covers both scripts: Cairo has Arabic + Latin but no
// Hebrew, Rubik has Hebrew + Latin but no Arabic. The app mixes them freely —
// an Arabic professional's name is shown to a Hebrew customer, and either user
// may type either script — so text in the "wrong" script must fall back to the
// system font instead of rendering as blanks or tofu.
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const HEBREW = /[֐-׿יִ-ﭏ]/;

/** True when the chosen brand face cannot draw this string. */
function scriptMismatch(value: string): boolean {
  return currentLang === "he" ? ARABIC.test(value) : HEBREW.test(value);
}

/** Concatenate a node's plain-string children; anything else is ignored. */
function stringOf(children: unknown): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(stringOf).join("");
  return "";
}

let applied = false;
export function applyGlobalFont(): void {
  if (applied) return;
  applied = true;

  // --- Text: brand font, unless the content is in the other script ---
  const TextAny = Text as any;
  const origTextRender = TextAny.render;
  if (origTextRender) {
    TextAny.render = function (...args: any[]) {
      const el = origTextRender.apply(this, args);
      if (!el) return el;
      const flat = (StyleSheet.flatten(el.props.style) || {}) as TextStyle;
      // Respect an explicit fontFamily (icon fonts set their own cut).
      if (flat.fontFamily) return el;
      if (scriptMismatch(stringOf(el.props.children))) {
        // Let the platform pick a face that can actually draw it.
        return React.cloneElement(el, { style: [el.props.style, { fontWeight: flat.fontWeight }] });
      }
      // fontWeight MUST be dropped once a named cut is chosen: combining the two
      // makes Android synthesise a second bold on top of an already-bold face.
      const patch: TextStyle = {
        fontFamily: fontFor(flat.fontWeight ? String(flat.fontWeight) : undefined),
        fontWeight: undefined,
      };
      return React.cloneElement(el, { style: [el.props.style, patch] });
    };
  }

  // --- TextInput: never force a brand face ---
  // What someone types is their business: an Arabic name in the Hebrew UI (or
  // vice versa) rendered blank, which reads as "the field won't accept input".
  // The system font covers both scripts, so input is always visible.
}
