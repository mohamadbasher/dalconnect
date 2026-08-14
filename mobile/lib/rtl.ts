// Both app languages (ar, he) are RTL. Like Dal/AutoHub we keep the native
// base direction LTR (forceRTL is unreliable in Expo Go) and lay out RTL
// explicitly with these helpers on every horizontal row / text.
import { I18nManager, TextStyle, ViewStyle } from "react-native";

export function ensureLtrBase() {
  try {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
  } catch {}
}

export const ROW: ViewStyle = { flexDirection: "row-reverse", alignItems: "center" };
export const ROW_LTR: ViewStyle = { flexDirection: "row", alignItems: "center" };
export const RTL_TEXT: TextStyle = { textAlign: "right", writingDirection: "rtl" };

/**
 * For TextInput, NOT Text.
 *
 * `writingDirection` is an iOS text-attribute meant for rendered text; forcing
 * it on an editable field fights the platform's own bidi handling and can leave
 * typed characters invisible. Inputs only need the alignment — iOS and Android
 * already order what you type by its own script.
 */
export const RTL_INPUT: TextStyle = { textAlign: "right" };
