// Customer registration — same visual system as sign-in (brand hero + sheet).
//
// The phone number is both the login identifier and the thing the marketplace
// later reveals to a matched professional, so it is sanitised while typing and
// stored in one canonical form (05XXXXXXXX).
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../lib/i18n";
import { useTheme, spacing } from "../../lib/theme";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import {
  AuthScreen,
  AuthHero,
  AuthSheet,
  AuthTabs,
  AuthCta,
  AuthLink,
  IconInput,
  PasswordField,
  FormError,
} from "../../components/auth-ui";
import { useAuth } from "../../context/AuthContext";
import { canonicalIsraeliPhone, phoneProblem, sanitizePhoneInput } from "../../lib/format";
import type { PhoneProblem } from "../../lib/format";

const MIN_PASSWORD = 6;

type FieldErrors = {
  fullName?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  terms?: string;
};

const PHONE_ERROR_KEY: Record<PhoneProblem, string> = {
  required: "authErrRequired",
  notDigits: "authErrPhoneLetters",
  tooShort: "authErrPhoneShort",
  tooLong: "authErrPhoneLong",
  badPrefix: "authErrPhonePrefix",
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
  // Errors appear only after the first submit, then keep re-validating live so
  // the message disappears the moment the field is actually fixed.
  const [submitted, setSubmitted] = useState(false);

  const computeErrors = useMemo(
    () => (): FieldErrors => {
      const e: FieldErrors = {};
      if (!fullName.trim()) e.fullName = t("authErrRequired");
      const problem = phoneProblem(phone);
      if (problem) e.phone = t(PHONE_ERROR_KEY[problem]);
      if (!password) e.password = t("authErrRequired");
      else if (password.length < MIN_PASSWORD) e.password = t("authErrPasswordShort");
      if (!confirm) e.confirm = t("authErrRequired");
      else if (confirm !== password) e.confirm = t("authErrPasswordMatch");
      if (!agreed) e.terms = t("authErrTerms");
      return e;
    },
    [fullName, phone, password, confirm, agreed, t]
  );

  const liveErrors = submitted ? computeErrors() : errors;

  const submit = async () => {
    setFormError("");
    setSubmitted(true);
    const e = computeErrors();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    const cleanPhone = canonicalIsraeliPhone(phone);
    try {
      await signUp({ fullName: fullName.trim(), phone: cleanPhone, password, lang });
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      setFormError(
        /already (registered|exists)|user_already_exists/i.test(msg)
          ? t("authErrPhoneTaken")
          : /network|fetch/i.test(msg)
            ? t("error")
            : t("error")
      );
      setLoading(false);
      return;
    }
    try {
      await signIn(cleanPhone, password);
      router.replace("/(tabs)");
    } catch {
      // the account exists but the immediate sign-in failed — hand off with a note
      router.replace({ pathname: "/(auth)/sign-in", params: { notice: "created" } });
    } finally {
      setLoading(false);
    }
  };

  const termsInvalid = Boolean(liveErrors.terms);

  return (
    <AuthScreen>
      <AuthHero
        title={t("appName")}
        tagline={t("authSignUpSubtitle")}
        onBack={router.canGoBack() ? () => router.back() : undefined}
      />

      <AuthSheet>
        <AuthTabs
          value="signUp"
          options={[
            { key: "signIn", label: t("authSignInTitle") },
            { key: "signUp", label: t("authCreateAccount") },
          ]}
          onChange={() => router.replace("/(auth)/sign-in")}
        />

        <View style={{ marginTop: spacing.xl, gap: 14 }}>
          <IconInput
            label={t("authFullName")}
            icon="person-outline"
            value={fullName}
            onChangeText={setFullName}
            error={liveErrors.fullName}
            placeholder={t("authFullNamePh")}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <IconInput
            label={t("authPhone")}
            icon="call-outline"
            value={phone}
            // strip anything that isn't a digit as it is typed or pasted, and cap
            // the length, so letters/spaces/dashes can never reach validation
            onChangeText={(v) => setPhone(sanitizePhoneInput(v))}
            error={liveErrors.phone}
            placeholder={t("authPhonePh")}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoCorrect={false}
            maxLength={14}
            returnKeyType="next"
            // a phone number is Latin digits — keep it left-to-right
            inputStyle={{ textAlign: "right", writingDirection: "ltr" }}
          />
          <PasswordField
            label={t("authPassword")}
            value={password}
            onChangeText={setPassword}
            error={liveErrors.password}
            placeholder={t("authPasswordPh")}
          />
          <PasswordField
            label={t("authConfirmPassword")}
            value={confirm}
            onChangeText={setConfirm}
            error={liveErrors.confirm}
          />

          {/* Terms — each document is its own link, not decoration next to a box */}
          <View style={{ gap: 6 }}>
            <View style={{ ...ROW, gap: spacing.sm, alignItems: "flex-start" }}>
              <Pressable
                onPress={() => setAgreed((v) => !v)}
                hitSlop={10}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: agreed ? colors.brand : termsInvalid ? colors.danger : colors.border,
                  backgroundColor: agreed ? colors.brand : colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                {agreed ? <Ionicons name="checkmark" size={16} color={colors.onBrand} /> : null}
              </Pressable>

              <Text style={[RTL_TEXT, { flex: 1, color: colors.muted, fontSize: 13.5, lineHeight: 21 }]}>
                <Text onPress={() => setAgreed((v) => !v)}>{t("authAgreePrefix")}</Text>
                <Text
                  onPress={() => router.push("/legal?tab=terms")}
                  style={{ color: colors.brand, fontWeight: "700", textDecorationLine: "underline" }}
                >
                  {t("authTermsLink")}
                </Text>
                <Text onPress={() => setAgreed((v) => !v)}>{t("authAgreeAnd")}</Text>
                <Text
                  onPress={() => router.push("/legal?tab=privacy")}
                  style={{ color: colors.brand, fontWeight: "700", textDecorationLine: "underline" }}
                >
                  {t("authPrivacyLink")}
                </Text>
              </Text>
            </View>
            {liveErrors.terms ? (
              <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{liveErrors.terms}</Text>
            ) : null}
          </View>

          <FormError message={formError} />
          <AuthCta title={t("authCreateAccount")} onPress={submit} loading={loading} />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <AuthLink label={t("authGoSignIn")} onPress={() => router.replace("/(auth)/sign-in")} />
        </View>
      </AuthSheet>
    </AuthScreen>
  );
}
