// Account settings — the irreversible corner of the app.
//
// Deleting an account used to sit on the profile tab, one tap from "language"
// and "appearance". Everything else on that page is reversible; this is not, so
// it lives behind its own door with room to say plainly what it does.
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button } from "../components/ui";

export default function AccountSettingsScreen() {
  const { colors, shadows } = useTheme();
  const { t } = useI18n();
  const { signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_account");
      if (error) throw error;
      await signOut();
      router.replace("/(auth)/welcome");
    } catch {
      Alert.alert(t("error"), t("profileDeleteError"));
    } finally {
      setDeleting(false);
    }
  };

  // Two confirms, and the second one names what is lost rather than asking
  // "are you sure?" a second time.
  const confirmDelete = () => {
    Alert.alert(t("profileDeleteAccount"), t("profileDeleteConfirm1"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("profileDeleteContinue"),
        style: "destructive",
        onPress: () => {
          Alert.alert(t("profileDeleteConfirm2Title"), t("profileDeleteConfirm2"), [
            { text: t("cancel"), style: "cancel" },
            { text: t("profileDeleteForever"), style: "destructive", onPress: deleteAccount },
          ]);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
          {t("profileSettings")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.dangerTint,
            padding: spacing.lg,
            gap: spacing.md,
            ...shadows.card,
          }}
        >
          <View style={{ ...ROW, alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: colors.dangerTint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </View>
            <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
              {t("profileDeleteAccount")}
            </Text>
          </View>

          <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, lineHeight: 20 }]}>
            {t("profileDeleteExplain")}
          </Text>

          <Button
            title={t("profileDeleteAccount")}
            variant="danger"
            onPress={confirmDelete}
            disabled={deleting}
            loading={deleting}
          />
          {deleting ? <ActivityIndicator size="small" color={colors.danger} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}
