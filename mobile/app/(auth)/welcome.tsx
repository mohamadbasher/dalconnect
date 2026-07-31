// Welcome / onboarding — full-screen brand experience on the Dal terracotta
// gradient. The ONLY screen allowed to hardcode hex (on-brand art, white text).
import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { setOnboarded } from "../../lib/onboarding";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n, LANG_NAMES } from "../../lib/i18n";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { radius, spacing } from "../../lib/theme";
import { isSupabaseConfigured } from "../../lib/supabase";
import type { Lang } from "../../lib/types";

const GRADIENT = ["#c25d27", "#a04c20", "#7c3a17"] as const;
const BRAND = "#c25d27";
const WHITE = "#ffffff";
const WHITE_70 = "rgba(255,255,255,0.7)";
const WHITE_DIM = "rgba(255,255,255,0.16)";
const WHITE_BORDER = "rgba(255,255,255,0.35)";

const LANGS: Lang[] = ["ar", "he"];

function LangPill({ code, active, onPress }: { code: Lang; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: active ? WHITE : WHITE_DIM,
        borderWidth: 1,
        borderColor: active ? WHITE : WHITE_BORDER,
        borderRadius: radius.full,
        paddingHorizontal: 18,
        paddingVertical: 8,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text style={{ color: active ? BRAND : WHITE, fontSize: 14, fontWeight: "700" }}>
        {LANG_NAMES[code]}
      </Text>
    </Pressable>
  );
}

function Feature({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ ...ROW, gap: spacing.md }}>
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: WHITE_DIM,
          borderWidth: 1,
          borderColor: WHITE_BORDER,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={20} color={WHITE} />
      </View>
      <Text style={[RTL_TEXT, { flex: 1, color: WHITE, fontSize: 15, fontWeight: "600" }]}>{text}</Text>
    </View>
  );
}

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();

  // Mark onboarding as seen — this screen only appears on first launch.
  useEffect(() => {
    setOnboarded();
  }, []);

  return (
    <LinearGradient colors={GRADIENT} style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.xl,
        }}
      >
        {/* language selector — first thing at the top */}
        <View style={{ ...ROW, justifyContent: "center", gap: spacing.sm }}>
          {LANGS.map((code) => (
            <LangPill key={code} code={code} active={lang === code} onPress={() => setLang(code)} />
          ))}
        </View>

        {/* brand block */}
        <View style={{ flex: 1, justifyContent: "center", gap: spacing.xxl }}>
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 28,
                backgroundColor: WHITE_DIM,
                borderWidth: 1,
                borderColor: WHITE_BORDER,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="hammer-wrench" size={46} color={WHITE} />
            </View>
            <Text style={{ color: WHITE, fontSize: 38, fontWeight: "800", textAlign: "center", writingDirection: "ltr" }}>
              DalConnect
            </Text>
            <Text
              style={{
                color: WHITE_70,
                fontSize: 16,
                fontWeight: "500",
                textAlign: "center",
                lineHeight: 24,
                paddingHorizontal: spacing.lg,
              }}
            >
              {t("authTagline")}
            </Text>
          </View>

          {/* feature highlights */}
          <View style={{ gap: spacing.lg, paddingHorizontal: spacing.xs }}>
            <Feature icon="shield-checkmark" text={t("authFeatFind")} />
            <Feature icon="pricetags" text={t("authFeatCompare")} />
            <Feature icon="checkmark-done-circle" text={t("authFeatTrack")} />
          </View>
        </View>

        {/* config warning */}
        {!isSupabaseConfigured ? (
          <View
            style={{
              ...ROW,
              gap: spacing.sm,
              backgroundColor: "rgba(0,0,0,0.25)",
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <Ionicons name="warning-outline" size={18} color={WHITE} />
            <Text style={[RTL_TEXT, { flex: 1, color: WHITE_70, fontSize: 12.5 }]}>{t("needConfig")}</Text>
          </View>
        ) : null}

        {/* CTAs */}
        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => router.push("/(auth)/sign-up")}
            style={({ pressed }) => ({
              backgroundColor: WHITE,
              borderRadius: radius.md,
              paddingVertical: 15,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            })}
          >
            <Text style={{ color: BRAND, fontSize: 16, fontWeight: "800" }}>{t("authCreateAccount")}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(auth)/sign-in")}
            style={({ pressed }) => ({
              paddingVertical: 14,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: WHITE, fontSize: 15, fontWeight: "700" }}>{t("authHaveAccount")}</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}
