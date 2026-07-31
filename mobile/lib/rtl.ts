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
