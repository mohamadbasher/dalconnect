// Sign in — centered, modern. Phone (or email) + password. No top header.
import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../lib/i18n";
import { useTheme, radius, spacing } from "../../lib/theme";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Button, Input } from "../../components/ui";
import { AuthShell, AuthBrand, PasswordField, FormError } from "../../components/auth-ui";
import { useAuth } from "../../context/AuthContext";
import { isValidIsraeliPhone } from "../../lib/format";

// Forgotten passwords are reset via support in v1.
const SUPPORT_WHATSAPP_NUMBER = "972500000000"; // TODO: replace with the real support number
const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;

export default function SignIn() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const { notice } = useLocalSearchParams<{ notice?: string }>();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    const id = identifier.trim();
    if (!id) e.identifier = t("authErrRequired");
    else if (!isValidIsraeliPhone(id)) e.identifier = t("authErrPhone");
    if (!password) e.password = t("authErrRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setFormError("");
    if (!validate()) return;
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      setFormError(/invalid login credentials/i.test(msg) ? t("authErrInvalidCredentials") : t("error"));
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthBrand subtitle={t("authSignInSubtitle")} />

      {/* just-signed-up notice */}
      {notice === "created" ? (
        <View
          style={{
            ...ROW,
            gap: spacing.sm,
            backgroundColor: colors.successTint,
            borderRadius: radius.md,
            padding: spacing.md,
          }}
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={[RTL_TEXT, { flex: 1, color: colors.success, fontSize: 13, fontWeight: "600" }]}>
            {t("authAccountCreated")}
          </Text>
        </View>
      ) : null}

      {/* form */}
      <View style={{ gap: spacing.lg }}>
        <Input
          label={t("authPhone")}
          value={identifier}
          onChangeText={setIdentifier}
          error={errors.identifier}
          placeholder={t("authPhonePh")}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <PasswordField
          label={t("authPassword")}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />
        <FormError message={formError} />
        <Button title={t("authSignInTitle")} onPress={submit} loading={loading} />
      </View>

      {/* go to sign-up */}
      <Pressable
        onPress={() => router.replace("/(auth)/sign-up")}
        style={({ pressed }) => ({ alignItems: "center", opacity: pressed ? 0.7 : 1 })}
      >
        <Text style={{ color: colors.brand, fontSize: 14, fontWeight: "700" }}>{t("authGoSignUp")}</Text>
      </Pressable>

      {/* forgot password → support */}
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, textAlign: "center" }]}>
          {t("authForgotNote")}
        </Text>
        <Pressable
          onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL).catch(() => {})}
          style={({ pressed }) => ({
            ...ROW,
            gap: 6,
            backgroundColor: colors.successTint,
            borderRadius: radius.full,
            paddingHorizontal: 14,
            paddingVertical: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name="logo-whatsapp" size={16} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 13, fontWeight: "700" }}>
            {t("authContactSupport")}
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
