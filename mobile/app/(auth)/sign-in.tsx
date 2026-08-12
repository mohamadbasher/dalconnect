// Customer sign in — Dal's auth design: brand hero + floating sheet.
// Providers have their own entrance (/(auth)/sign-in-provider), linked from the
// footer; the identifier here is the customer's phone number.
import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../lib/i18n";
import { useTheme, radius, spacing } from "../../lib/theme";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import {
  AuthScreen,
  AuthHero,
  AuthSheet,
  AuthTabs,
  AuthCta,
  AuthLink,
  AuthFooter,
  IconInput,
  PasswordField,
  FormError,
} from "../../components/auth-ui";
import { useAuth } from "../../context/AuthContext";
import { isValidIsraeliPhone, sanitizePhoneInput } from "../../lib/format";
import { looksLikeProviderNo } from "../../lib/supabase";

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
    // a provider signs in with six digits; a customer with a 10-digit phone
    else if (!looksLikeProviderNo(id) && !isValidIsraeliPhone(id)) e.identifier = t("authErrIdentifier");
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
    <AuthScreen>
      <AuthHero
        title={t("appName")}
        tagline={t("authSignInSubtitle")}
        onBack={router.canGoBack() ? () => router.back() : undefined}
      />

      <AuthSheet>
        <AuthTabs
          value="signIn"
          options={[
            { key: "signIn", label: t("authSignInTitle") },
            { key: "signUp", label: t("authCreateAccount") },
          ]}
          onChange={() => router.replace("/(auth)/sign-up")}
        />

        {/* just-signed-up notice */}
        {notice === "created" ? (
          <View
            style={{
              ...ROW,
              gap: spacing.sm,
              backgroundColor: colors.successTint,
              borderRadius: radius.md,
              padding: spacing.md,
              marginTop: spacing.lg,
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[RTL_TEXT, { flex: 1, color: colors.success, fontSize: 13, fontWeight: "600" }]}>
              {t("authAccountCreated")}
            </Text>
          </View>
        ) : null}

        {/* form */}
        <View style={{ marginTop: spacing.xl, gap: 14 }}>
          <IconInput
            label={t("authPhone")}
            icon="call-outline"
            value={identifier}
            onChangeText={(v) => setIdentifier(sanitizePhoneInput(v))}
            maxLength={14}
            textContentType="telephoneNumber"
            autoComplete="tel"
            error={errors.identifier}
            placeholder={t("authPhonePh")}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
            // a phone number is Latin digits — keep it left-to-right
            inputStyle={{ textAlign: "right", writingDirection: "ltr" }}
          />
          <PasswordField
            label={t("authPassword")}
            value={password}
            onChangeText={setPassword}
            error={errors.password}
          />
          <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, marginTop: -6 }]}>
            {t("authSignInHint")}
          </Text>
          <FormError message={formError} />
          <AuthCta title={t("authSignInTitle")} onPress={submit} loading={loading} />
        </View>

        {/* go to sign-up */}
        <View style={{ marginTop: spacing.lg }}>
          <AuthLink label={t("authGoSignUp")} onPress={() => router.replace("/(auth)/sign-up")} />
        </View>

        {/* providers sign in on their own track */}
        <AuthFooter
          hint={t("provSignInEntryHint")}
          action={t("provSignInEntry")}
          icon="construct-outline"
          onPress={() => router.push("/(auth)/sign-in-provider")}
        />

        {/* forgot password → support */}
        <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.xl }}>
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
      </AuthSheet>
    </AuthScreen>
  );
}
