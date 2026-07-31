// Report a problem — reason chips + details, writes a row into `reports`.
import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button, Chip, Input } from "../components/ui";

const REASONS: { slug: string; key: string }[] = [
  { slug: "unprofessional_behavior", key: "reportReasonUnprofessional" },
  { slug: "no_show", key: "reportReasonNoShow" },
  { slug: "wrong_price", key: "reportReasonWrongPrice" },
  { slug: "fraud", key: "reportReasonFraud" },
  { slug: "other", key: "reportReasonOther" },
];

export default function ReportScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId, bookingId } = useLocalSearchParams<{ userId?: string; bookingId?: string }>();

  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!session?.user || !reason) return;
    if (reason === "other" && !details.trim()) {
      setDetailsError(t("reportDetailsRequired"));
      return;
    }
    setDetailsError("");
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: session.user.id,
        reported_user_id: userId ?? null,
        booking_id: bookingId ?? null,
        reason,
        details: details.trim(),
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(true);
    } catch {
      Alert.alert(t("error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header */}
      <View
        style={{
          ...ROW,
          gap: spacing.md,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
          {t("reportTitle")}
        </Text>
      </View>

      {done ? (
        /* success state */
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg }}>
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              backgroundColor: colors.successTint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="checkmark-circle" size={52} color={colors.success} />
          </View>
          <Text style={[RTL_TEXT, { color: colors.text, fontSize: 19, fontWeight: "800", textAlign: "center" }]}>
            {t("reportSuccessTitle")}
          </Text>
          <Text
            style={[
              RTL_TEXT,
              { color: colors.muted, fontSize: 14.5, textAlign: "center", lineHeight: 22, paddingHorizontal: spacing.lg },
            ]}
          >
            {t("reportSuccessBody")}
          </Text>
          <Button title={t("done")} onPress={() => router.back()} style={{ alignSelf: "stretch" }} />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl }}
            keyboardShouldPersistTaps="handled"
          >
            {/* reason chips */}
            <View style={{ gap: spacing.md }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "700" }]}>
                {t("reportReasonLabel")}
              </Text>
              <View style={{ ...ROW, flexWrap: "wrap", gap: spacing.sm, alignItems: "flex-start" }}>
                {REASONS.map((r) => (
                  <Chip
                    key={r.slug}
                    label={t(r.key)}
                    active={reason === r.slug}
                    onPress={() => {
                      setReason(r.slug);
                      if (r.slug !== "other" && detailsError) setDetailsError("");
                    }}
                  />
                ))}
              </View>
            </View>

            {/* details */}
            <Input
              label={`${t("reportDetailsLabel")}${reason === "other" ? "" : ` (${t("optional")})`}`}
              value={details}
              onChangeText={(v) => {
                setDetails(v);
                if (detailsError) setDetailsError("");
              }}
              error={detailsError}
              placeholder={t("reportDetailsPlaceholder")}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={{ minHeight: 120 }}
            />

            <Button title={t("reportSubmit")} onPress={submit} loading={submitting} disabled={!reason} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
