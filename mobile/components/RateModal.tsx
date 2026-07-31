// Reusable rating modal — stars only (product decision), writes a review row.
// The DB trigger updates the professional's aggregates and flips the booking
// status to 'rated'; we only insert and report back via onDone.
import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button, Card, StarRating } from "./ui";

export function RateModal({
  visible,
  bookingId,
  customerId,
  professionalId,
  onClose,
  onDone,
}: {
  visible: boolean;
  bookingId: string;
  customerId: string;
  professionalId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fresh state every time the modal opens
  useEffect(() => {
    if (visible) {
      setRating(0);
      setSaving(false);
      setError(null);
    }
  }, [visible]);

  const submit = async () => {
    if (rating < 1 || saving) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("reviews").insert({
      booking_id: bookingId,
      customer_id: customerId,
      professional_id: professionalId,
      rating,
    });
    setSaving(false);
    if (err) {
      // unique(booking_id) — the booking was already rated; treat as done.
      if ((err as { code?: string }).code === "23505") {
        setError(t("alreadyRated"));
        onDone();
        return;
      }
      setError(t("error"));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xl,
        }}
      >
        <Card style={{ width: "100%", maxWidth: 380, gap: spacing.lg, alignItems: "center" }}>
          <View style={{ ...ROW, justifyContent: "flex-end", alignSelf: "stretch" }}>
            <Pressable onPress={onClose} hitSlop={10} disabled={saving}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={[RTL_TEXT, { color: colors.text, fontSize: 19, fontWeight: "800", textAlign: "center" }]}>
            {t("rateTitle")}
          </Text>
          <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, textAlign: "center" }]}>
            {t("rateSubtitle")}
          </Text>
          <StarRating rating={rating} size={40} onRate={setRating} />
          {error ? (
            <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12.5, textAlign: "center" }]}>{error}</Text>
          ) : null}
          <Button
            title={t("submitRating")}
            onPress={submit}
            loading={saving}
            disabled={rating < 1}
            icon="star"
            style={{ alignSelf: "stretch" }}
          />
        </Card>
      </View>
    </Modal>
  );
}
