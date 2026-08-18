// Customer sign-in and registration in ONE screen.
//
// The segmented control switches a local `mode` — it does not navigate. Routing
// between two screens made the swap look like a page change (a transition, a
// re-mounted hero, a flash); here only the form body changes, exactly like
// Dal's auth form.
//
// `/sign-in` and `/sign-up` both still exist as routes and simply mount this
// with a different starting mode, so existing links and deep links keep working.
import React, { useMemo, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../lib/i18n";
import { useTheme, radius, spacing } from "../lib/theme";
import { ROW, RTL_TEXT } from "../lib/rtl";
import {
  AuthScreen,
  AuthHeaderLight,
  AuthGreeting,
  AuthTabs,
  AuthCta,
  EntranceCard,
  FieldCard,
  PasswordCard,
  FormError,
  OrDivider,
} from "./auth-ui";
import { useAuth } from "../context/AuthContext";
import { canonicalIsraeliPhone, isValidIsraeliPhone, phoneProblem, sanitizePhoneInput } from "../lib/format";
import type { PhoneProblem } from "../lib/format";
import { looksLikeProviderNo } from "../lib/supabase";

// Forgotten passwords are reset via support in v1.
const SUPPORT_WHATSAPP_NUMBER = "972500000000"; // TODO: replace with the real support number
const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;

const MIN_PASSWORD = 6;

const PHONE_ERROR_KEY: Record<PhoneProblem, string> = {
  required: "authErrRequired",
  notDigits: "authErrPhoneLetters",
  tooShort: "authErrPhoneShort",
  tooLong: "authErrPhoneLong",
  badPrefix: "authErrPhonePrefix",
};

type Mode = "signIn" | "signUp";

type SignUpErrors = {
  fullName?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  terms?: string;
};

export function CustomerAuth({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { signIn, signUp } = useAuth();
  const { notice } = useLocalSearchParams<{ notice?: string }>();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // --- sign in ---
  const [identifier, setIdentifier] = useState("");
  const [inErrors, setInErrors] = useState<{ identifier?: string; password?: string }>({});

  // --- sign up ---
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [upErrors, setUpErrors] = useState<SignUpErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // shared by both forms
  const [password, setPassword] = useState("");

  // Password resets go through support in v1 — the same target the WhatsApp
  // block below uses, so "forgot password?" and it can never drift apart.
  const openSupport = () => {
    Linking.openURL(SUPPORT_WHATSAPP_URL).catch(() => {});
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setFormError("");
    setInErrors({});
    setUpErrors({});
    setSubmitted(false);
  };

  // ---------------- sign in ----------------
  const submitSignIn = async () => {
    setFormError("");
    const e: typeof inErrors = {};
    const id = identifier.trim();
    if (!id) e.identifier = t("authErrRequired");
    // a provider signs in with six digits; a customer with a 10-digit phone
    else if (!looksLikeProviderNo(id) && !isValidIsraeliPhone(id)) e.identifier = t("authErrIdentifier");
    if (!password) e.password = t("authErrRequired");
    setInErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await signIn(id, password);
      // "/" decides customer vs provider once the profile loads;
      // "/(tabs)" is the CUSTOMER home and would strand every provider there.
      router.replace("/");
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      setFormError(/invalid login credentials/i.test(msg) ? t("authErrInvalidCredentials") : t("error"));
      setLoading(false);
    }
  };

  // ---------------- sign up ----------------
  const computeUpErrors = useMemo(
    () => (): SignUpErrors => {
      const e: SignUpErrors = {};
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

  // errors appear on first submit, then re-validate live so a fixed field clears
  const liveUpErrors = submitted ? computeUpErrors() : upErrors;

  const submitSignUp = async () => {
    setFormError("");
    setSubmitted(true);
    const e = computeUpErrors();
    setUpErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    const cleanPhone = canonicalIsraeliPhone(phone);
    try {
      await signUp({ fullName: fullName.trim(), phone: cleanPhone, password, lang });
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      setFormError(
        /already (registered|exists)|user_already_exists/i.test(msg) ? t("authErrPhoneTaken") : t("error")
      );
      setLoading(false);
      return;
    }
    try {
      await signIn(cleanPhone, password);
      // "/" decides customer vs provider once the profile loads;
      // "/(tabs)" is the CUSTOMER home and would strand every provider there.
      router.replace("/");
    } catch {
      // the account exists but the immediate sign-in failed — fall back to the form
      setLoading(false);
      switchMode("signIn");
      setIdentifier(cleanPhone);
      setFormError(t("authAccountCreated"));
    }
  };

  const termsInvalid = Boolean(liveUpErrors.terms);
  const signingIn = mode === "signIn";

  return (
    <AuthScreen light>
      <AuthHeaderLight tagline={t("authWelcomeNewSub")} />

      {/* the header already fades into this surface, so no seam is needed */}
      <View
        style={{
          flexGrow: 1,
          backgroundColor: colors.card,
          paddingHorizontal: 20,
          paddingTop: 2,
          paddingBottom: 28,
          gap: 16,
        }}
      >
        <AuthGreeting
          title={signingIn ? t("authWelcomeBack") : t("authWelcomeNew")}
          subtitle={signingIn ? t("authWelcomeBackSub") : t("authWelcomeNewSub")}
        />

        <AuthTabs
          value={mode}
          options={[
            { key: "signIn" as Mode, label: t("authSignInTitle"), icon: "person-outline" },
            { key: "signUp" as Mode, label: t("authCreateAccount"), icon: "person-add-outline" },
          ]}
          onChange={switchMode}
        />

        {/* just-signed-up notice */}
        {signingIn && notice === "created" ? (
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

        <View style={{ gap: 14 }}>
          {signingIn ? (
            <>
              <FieldCard
                key="signin-phone"
                label={t("authPhone")}
                icon="call-outline"
                value={identifier}
                onChangeText={(v) => setIdentifier(sanitizePhoneInput(v))}
                maxLength={14}
                textContentType="telephoneNumber"
                autoComplete="tel"
                error={inErrors.identifier}
                placeholder={t("authPhonePh")}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                inputStyle={{ textAlign: "right", writingDirection: "ltr" }}
              />
              <PasswordCard
                key="signin-pass"
                label={t("authPassword")}
                value={password}
                onChangeText={setPassword}
                error={inErrors.password}
              />
              {/* forgot password sits opposite the hint, as in the design */}
              <View style={{ ...ROW, justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[RTL_TEXT, { flex: 1, color: colors.faint, fontSize: 12 }]}>
                  {t("authSignInHint")}
                </Text>
                <Pressable onPress={openSupport} hitSlop={8}>
                  <Text
                    style={{
                      color: colors.brand,
                      fontSize: 12.5,
                      fontWeight: "700",
                      textDecorationLine: "underline",
                    }}
                  >
                    {t("authForgotLink")}
                  </Text>
                </Pressable>
              </View>
              <FormError message={formError} />
              <AuthCta title={t("authSignInTitle")} onPress={submitSignIn} loading={loading} />
            </>
          ) : (
            <>
              {/* UNCONTROLLED on purpose. The sign-in tab's phone field occupies
                  this same tree position, so React reuses one native input for
                  both; as a controlled field the stale instance kept reverting
                  every keystroke to "" — typing showed nothing. `key` forces a
                  fresh input per tab, and `defaultValue` lets the native widget
                  own the text, so what you type is always what you see. */}
              <FieldCard
                key="signup-name"
                label={t("authFullName")}
                icon="person-outline"
                defaultValue={fullName}
                onChangeText={setFullName}
                error={liveUpErrors.fullName}
                placeholder={t("authFullNamePh")}
                autoCapitalize="words"
              />
              <FieldCard
                key="signup-phone"
                label={t("authPhone")}
                icon="call-outline"
                value={phone}
                onChangeText={(v) => setPhone(sanitizePhoneInput(v))}
                error={liveUpErrors.phone}
                placeholder={t("authPhonePh")}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                autoCorrect={false}
                maxLength={14}
                inputStyle={{ textAlign: "right", writingDirection: "ltr" }}
              />
              <PasswordCard
                key="signup-pass"
                label={t("authPassword")}
                value={password}
                onChangeText={setPassword}
                error={liveUpErrors.password}
                placeholder={t("authPasswordPh")}
              />
              <PasswordCard
                key="signup-pass2"
                label={t("authConfirmPassword")}
                value={confirm}
                onChangeText={setConfirm}
                error={liveUpErrors.confirm}
              />

              {/* Terms — each document is its own link, not decoration */}
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
                {liveUpErrors.terms ? (
                  <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{liveUpErrors.terms}</Text>
                ) : null}
              </View>

              <FormError message={formError} />
              <AuthCta title={t("authCreateAccount")} onPress={submitSignUp} loading={loading} />
            </>
          )}
        </View>

        <OrDivider label={t("authOr")} />

        {/* providers have their own entrance — a card that says who it is for */}
        <EntranceCard
          icon="hammer-wrench"
          title={t("provSignInEntry")}
          subtitle={t("provEntranceSub")}
          onPress={() => router.push("/(auth)/sign-in-provider")}
        />

        {/* forgot password → support (sign-in only) — unchanged */}
        {signingIn ? (
          <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, textAlign: "center" }]}>
              {t("authForgotNote")}
            </Text>
            <Pressable
              onPress={openSupport}
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
        ) : null}
      </View>
    </AuthScreen>
  );
}
