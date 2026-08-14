// Quick request — "I don't know which service I need".
//
// The customer describes the problem in their own words and we name the trade.
// This exists because the service grid asks a question a customer in trouble
// can't always answer: a leak under the sink is obviously a plumber to us and
// not at all obvious to someone whose kitchen is flooding.
//
// It ends where the normal flow starts: /create-booking with the category and
// the text already filled in, so nothing is typed twice.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { fetchCategories } from "../lib/refdata";
import { suggestCategories, type Suggestion } from "../lib/suggest";
import { ROW, RTL_TEXT, RTL_INPUT } from "../lib/rtl";
import { Button, pressCard } from "../components/ui";
import type { Category } from "../lib/types";

/** icons come from the DB — never trust them blindly */
function safeIcon(icon?: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  return (icon && MaterialCommunityIcons.glyphMap[icon as keyof typeof MaterialCommunityIcons.glyphMap]
    ? icon
    : "tools") as keyof typeof MaterialCommunityIcons.glyphMap;
}

const MIN_CHARS = 4;

export default function QuickRequestScreen() {
  const { colors, shadows } = useTheme();
  const { t, loc, lang } = useI18n();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [cats, setCats] = useState<Category[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  /** null = haven't asked yet; [] = asked and we genuinely don't know */
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const [tooShort, setTooShort] = useState(false);

  useEffect(() => {
    fetchCategories()
      .then(setCats)
      .catch(() => setCats([]));
  }, []);

  const examples = useMemo(
    () => [t("qrExample1"), t("qrExample2"), t("qrExample3"), t("qrExample4")],
    [t]
  );

  const run = async (value: string) => {
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setTooShort(true);
      return;
    }
    setTooShort(false);
    setThinking(true);
    const { results: found } = await suggestCategories(q, cats, lang);
    setResults(found);
    setThinking(false);
  };

  /** Tapping an example runs it immediately — it's a shortcut, not a template. */
  const useExample = (example: string) => {
    setText(example);
    run(example);
  };

  const goToBooking = (cat: Category) => {
    router.push(
      `/create-booking?categoryId=${cat.id}&description=${encodeURIComponent(text.trim())}`
    );
  };

  const backToEditing = () => {
    setResults(null);
    // The description survives — they're refining it, not starting over.
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* header: back sits on the visual right */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          ...ROW,
          gap: spacing.sm,
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [
            {
              width: 40,
              height: 40,
              borderRadius: radius.full,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
              ...shadows.card,
            },
            pressed ? pressCard : null,
          ]}
        >
          {/* RTL back points right */}
          <Ionicons name="arrow-forward" size={20} color={colors.text} />
        </Pressable>
        <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 17, fontWeight: "800" }]}>
          {t("qrTitle")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {results === null ? (
          <>
            <View style={{ gap: spacing.xs }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 21, fontWeight: "800" }]}>
                {t("qrHeading")}
              </Text>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, lineHeight: 20 }]}>
                {t("qrSubtitle")}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: tooShort ? colors.danger : colors.border,
                padding: spacing.md,
                ...shadows.card,
              }}
            >
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  if (tooShort) setTooShort(false);
                }}
                placeholder={t("qrPlaceholder")}
                placeholderTextColor={colors.faint}
                multiline
                autoFocus
                textAlignVertical="top"
                style={[
                  RTL_INPUT,
                  { minHeight: 96, fontSize: 15, lineHeight: 22, color: colors.text, padding: 0 },
                ]}
              />
            </View>

            {tooShort ? (
              <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12.5, marginTop: -spacing.sm }]}>
                {t("qrTooShort")}
              </Text>
            ) : null}

            <Button
              title={thinking ? t("qrThinking") : t("qrSubmit")}
              icon={thinking ? undefined : "auto-fix"}
              loading={thinking}
              onPress={() => run(text)}
            />

            {/* Examples double as instructions: they show the level of detail
                that works, without a paragraph explaining it. */}
            <View style={{ gap: spacing.sm }}>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5, fontWeight: "700" }]}>
                {t("qrExamplesTitle")}
              </Text>
              <View
                style={{
                  flexDirection: "row-reverse",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                  alignItems: "flex-start",
                }}
              >
                {examples.map((ex) => (
                  <Pressable
                    key={ex}
                    onPress={() => useExample(ex)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.chip,
                        borderRadius: radius.full,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 8,
                      },
                      pressed ? pressCard : null,
                    ]}
                  >
                    <Text style={{ color: colors.muted, fontSize: 12.5 }}>{ex}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : results.length > 0 ? (
          <>
            <View style={{ gap: spacing.xs }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 20, fontWeight: "800" }]}>
                {t("qrResultsTitle")}
              </Text>
              <Text numberOfLines={2} style={[RTL_TEXT, { color: colors.muted, fontSize: 13 }]}>
                “{text.trim()}”
              </Text>
            </View>

            <View style={{ gap: spacing.md }}>
              {results.map((s, i) => {
                const best = i === 0;
                return (
                  <Pressable
                    key={s.category.id}
                    onPress={() => goToBooking(s.category)}
                    style={({ pressed }) => [
                      {
                        ...ROW,
                        alignItems: "center",
                        gap: spacing.md,
                        backgroundColor: colors.card,
                        borderRadius: radius.lg,
                        borderWidth: best ? 1.5 : 1,
                        borderColor: best ? colors.brand : colors.border,
                        padding: spacing.md,
                        ...shadows.card,
                      },
                      pressed ? pressCard : null,
                    ]}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: radius.tile,
                        backgroundColor: colors.brandTint,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialCommunityIcons
                        name={safeIcon(s.category.icon)}
                        size={24}
                        color={colors.brand}
                      />
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
                        {loc(s.category, "name")}
                      </Text>
                      {best ? (
                        <View style={{ ...ROW, alignItems: "center", gap: 4 }}>
                          <MaterialCommunityIcons name="star-four-points" size={12} color={colors.brand} />
                          <Text style={{ color: colors.brand, fontSize: 11.5, fontWeight: "700" }}>
                            {t("qrBestMatch")}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Ionicons name="chevron-back" size={16} color={colors.faint} />
                  </Pressable>
                );
              })}
            </View>

            <Button title={t("qrEditText")} variant="outline" icon="pencil-outline" onPress={backToEditing} />
          </>
        ) : (
          // Asked, and we honestly don't know. Say so and hand them the catalogue
          // rather than guessing a trade and wasting everyone's time.
          <View style={{ gap: spacing.lg, paddingTop: spacing.xl, alignItems: "center" }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.full,
                backgroundColor: colors.chip,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="help-circle-outline" size={34} color={colors.faint} />
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center" }}>
                {t("qrNoMatchTitle")}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 20, textAlign: "center" }}>
                {t("qrNoMatchSubtitle")}
              </Text>
            </View>
            <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
              <Button title={t("qrEditText")} icon="pencil-outline" onPress={backToEditing} />
              <Button
                title={t("qrBrowseAll")}
                variant="outline"
                icon="view-grid-outline"
                onPress={() => router.replace("/search")}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
