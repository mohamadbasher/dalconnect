// Sign up — centered, modern, same design as sign-in. No top header.
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "../../lib/i18n";
import { useTheme, radius, spacing } from "../../lib/theme";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Button, Input } from "../../components/ui";
import { AuthShell, AuthBrand, PasswordField, FormError } from "../../components/auth-ui";
import { useAuth } from "../../context/AuthContext";
import { isValidIsraeliPhone, normalizePhone } from "../../lib/format";

type FieldErrors = {
  fullName?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  terms?: string;
};

export default function SignUp() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { signUp, signIn } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: FieldErrors = {};
    if (!fullName.trim()) e.fullName = t("authErrRequired");
    if (!phone.trim()) e.phone = t("authErrRequired");
    else if (!isValidIsraeliPhone(phone)) e.phone = t("authErrPhone");
    if (!password) e.password = t("authErrRequired");
    else if (password.length < 6) e.password = t("authErrPasswordShort");
    if (confirm !== password) e.confirm = t("authErrPasswordMatch");
    if (!agreed) e.terms = t("authErrTerms");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setFormError("");
    if (!validate()) return;
    setLoading(true);
    const cleanPhone = normalizePhone(phone);
    try {
      await signUp({ fullName: fullName.trim(), phone: cleanPhone, password, lang });
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      setFormError(/already (registered|exists)/i.test(msg) ? t("authErrPhoneTaken") : t("error"));
      setLoading(false);
      return;
    }
    try {
      await signIn(cleanPhone, password);
      router.replace("/(tabs)");
    } catch {
      // account exists but auto sign-in failed — send them to sign-in with a friendly note
      router.replace({ pathname: "/(auth)/sign-in", params: { notice: "created" } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthBrand subtitle={t("authSignUpSubtitle")} />

      {/* form */}
      <View style={{ gap: spacing.lg }}>
        <Input
          label={t("authFullName")}
          value={fullName}
          onChangeText={setFullName}
          error={errors.fullName}
          placeholder={t("authFullNamePh")}
        />
        <Input
          label={t("authPhone")}
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          placeholder={t("authPhonePh")}
          keyboardType="phone-pad"
          autoCorrect={false}
        />
        <PasswordField
          label={t("authPassword")}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          placeholder={t("authPasswordPh")}
        />
        <PasswordField
          label={t("authConfirmPassword")}
          value={confirm}
          onChangeText={setConfirm}
          error={errors.confirm}
        />

        {/* terms agreement */}
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => setAgreed((v) => !v)} style={{ ...ROW, gap: spacing.sm }} hitSlop={6}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                borderWidth: 1.5,
                borderColor: agreed ? colors.brand : colors.border,
                backgroundColor: agreed ? colors.brand : colors.card,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {agreed ? <Ionicons name="checkmark" size={15} color={colors.onBrand} /> : null}
            </View>
            <Text style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 13.5 }]}>
              {t("authAgreeTerms")}
            </Text>
          </Pressable>
          {errors.terms ? (
            <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{errors.terms}</Text>
          ) : null}
        </View>

        <FormError message={formError} />
        <Button title={t("authCreateAccount")} onPress={submit} loading={loading} />
      </View>

      {/* professional hint */}
      <View
        style={{
          ...ROW,
          gap: spacing.sm,
          backgroundColor: colors.brandTint,
          borderRadius: radius.md,
          padding: spacing.md,
        }}
      >
        <MaterialCommunityIcons name="briefcase-outline" size={19} color={colors.brand} />
        <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 }]}>
          {t("authProNote")}
        </Text>
      </View>

      {/* go to sign-in */}
      <Pressable
        onPress={() => router.replace("/(auth)/sign-in")}
        style={({ pressed }) => ({ alignItems: "center", opacity: pressed ? 0.7 : 1 })}
      >
        <Text style={{ color: colors.brand, fontSize: 14, fontWeight: "700" }}>{t("authGoSignIn")}</Text>
      </Pressable>
    </AuthShell>
  );
}
