// Register as a service provider — a separate account from any customer
// account on the same phone (Dal's merchant-registration model).
//
// The six-digit login number is derived from the last six digits of the phone
// and previewed live, so the provider knows it before they submit.
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../lib/i18n";
import { useTheme, radius, spacing, brandGradientProps } from "../../lib/theme";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Button, Input } from "../../components/ui";
import { PasswordField, FormError } from "../../components/auth-ui";
import { useAuth } from "../../context/AuthContext";
import { canonicalIsraeliPhone, phoneProblem, sanitizePhoneInput } from "../../lib/format";
import type { PhoneProblem } from "../../lib/format";

const MIN_PASSWORD = 6;

const PHONE_ERROR_KEY: Record<PhoneProblem, string> = {
  required: "authErrRequired",
  notDigits: "authErrPhoneLetters",
  tooShort: "authErrPhoneShort",
  tooLong: "authErrPhoneLong",
  badPrefix: "authErrPhonePrefix",
};

type FieldErrors = {
  fullName?: string;
  businessName?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  terms?: string;
};

export default function RegisterProvider() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { colors, shadows } = useTheme();
  const { signUpProvider, signIn } = useAuth();

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [issuedNo, setIssuedNo] = useState<string | null>(null);

  // Live preview of the login number: the last six digits of what they typed.
  const previewNo = useMemo(() => {
    const d = canonicalIsraeliPhone(phone);
    return d.length >= 6 ? d.slice(-6) : "";
  }, [phone]);

  const computeErrors = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!fullName.trim()) e.fullName = t("authErrRequired");
    if (!businessName.trim()) e.businessName = t("authErrRequired");
    const problem = phoneProblem(phone);
    if (problem) e.phone = t(PHONE_ERROR_KEY[problem]);
    if (!password) e.password = t("authErrRequired");
    else if (password.length < MIN_PASSWORD) e.password = t("authErrPasswordShort");
    if (!confirm) e.confirm = t("authErrRequired");
    else if (confirm !== password) e.confirm = t("authErrPasswordMatch");
    if (!agreed) e.terms = t("authErrTerms");
    return e;
  };

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
      const no = await signUpProvider({
        fullName: fullName.trim(),
        phone: cleanPhone,
        password,
        businessName: businessName.trim(),
        lang,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIssuedNo(no);
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      setFormError(
        msg === "PROVIDER_EXISTS"
          ? t("provErrExists")
          : msg === "NO_PROVIDER_NUMBER"
            ? t("provErrNoNumber")
            : t("error")
      );
    } finally {
      setLoading(false);
    }
  };

  // Once the number is shown, entering the app signs them in with it.
  const enterApp = async () => {
    if (!issuedNo) return;
    try {
      await signIn(issuedNo, password);
      router.replace("/(tabs)");
    } catch {
      router.replace({ pathname: "/(auth)/sign-in", params: { notice: "created" } });
    }
  };

  const termsInvalid = Boolean(liveErrors.terms);

  return (
    <View style={{ flex: 1, backgroundColor: colors.brand }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {/* brand hero */}
          <LinearGradient
            {...brandGradientProps}
            style={{ paddingTop: insets.top + 26, paddingBottom: 46, alignItems: "center" }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={{
                position: "absolute",
                // RTL: back sits on the start (right) edge
                right: 14,
                top: insets.top + 6,
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "rgba(255,255,255,0.18)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>

            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 24,
                backgroundColor: "rgba(255,255,255,0.18)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.35)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="hammer-wrench" size={38} color="#fff" />
            </View>
            <Text
              style={{
                color: "#fff",
                fontSize: 21,
                fontWeight: "800",
                marginTop: 12,
                textAlign: "center",
                paddingHorizontal: 30,
              }}
            >
              {t("provRegTitle")}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 13,
                marginTop: 4,
                textAlign: "center",
                paddingHorizontal: 32,
              }}
            >
              {t("provRegTagline")}
            </Text>
          </LinearGradient>

          {/* floating sheet */}
          <View
            style={{
              flexGrow: 1,
              backgroundColor: colors.bg,
              borderTopLeftRadius: 34,
              borderTopRightRadius: 34,
              marginTop: -26,
              paddingBottom: insets.bottom + spacing.xxl,
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 44,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: colors.border,
                marginTop: 14,
              }}
            />

            <View style={{ padding: spacing.lg, gap: spacing.lg }}>
              <Input
                label={t("authFullName")}
                value={fullName}
                onChangeText={setFullName}
                error={liveErrors.fullName}
                placeholder={t("authFullNamePh")}
                autoCapitalize="words"
              />
              <Input
                label={t("provBusinessName")}
                value={businessName}
                onChangeText={setBusinessName}
                error={liveErrors.businessName}
                placeholder={t("provBusinessNamePh")}
              />
              <Input
                label={t("authPhone")}
                value={phone}
                onChangeText={(v) => setPhone(sanitizePhoneInput(v))}
                error={liveErrors.phone}
                placeholder={t("authPhonePh")}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                autoCorrect={false}
                maxLength={14}
              />

              {/* the login number, derived and read-only */}
              <View style={{ gap: 6 }}>
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, fontWeight: "600" }]}>
                  {t("provNoLabel")}
                </Text>
                <View pointerEvents="none">
                  <TextInput
                    editable={false}
                    value={previewNo}
                    placeholder={t("provNoPlaceholder")}
                    placeholderTextColor={colors.faint}
                    style={{
                      backgroundColor: colors.chip,
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: previewNo ? 18 : 14,
                      fontWeight: previewNo ? "800" : "400",
                      color: previewNo ? colors.brandDark : colors.faint,
                      textAlign: "center",
                      // spacing the digits helps them read as a code, but it
                      // would tear the placeholder sentence apart
                      letterSpacing: previewNo ? 4 : 0,
                    }}
                  />
                </View>
                <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 11.5, lineHeight: 17 }]}>
                  {t("provNoHint")}
                </Text>
              </View>

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

              {/* terms */}
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
              <Button title={t("provRegCta")} onPress={submit} loading={loading} />

              <View
                style={{
                  ...ROW,
                  gap: spacing.sm,
                  backgroundColor: colors.brandTint,
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <Ionicons name="information-circle-outline" size={18} color={colors.brand} />
                <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 12.5, lineHeight: 19 }]}>
                  {t("provSameHoneNote")}
                </Text>
              </View>

              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                style={({ pressed }) => ({ alignItems: "center", opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ color: colors.brand, fontSize: 14, fontWeight: "700" }}>{t("authGoSignIn")}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* success — the login number is the whole point of this screen */}
      <Modal visible={!!issuedNo} transparent animationType="fade" onRequestClose={enterApp}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: 28,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 340,
              backgroundColor: colors.card,
              borderRadius: 28,
              paddingVertical: 32,
              paddingHorizontal: 24,
              alignItems: "center",
              gap: spacing.md,
              ...shadows.float,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.success,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark" size={34} color="#fff" />
            </View>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" }}>
              {t("provSuccessTitle")}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 20 }}>
              {t("provSuccessBody")}
            </Text>

            <View
              style={{
                width: "100%",
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: colors.brand,
                backgroundColor: colors.brandTint,
                paddingVertical: 16,
                paddingHorizontal: 14,
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                {t("provSuccessNoLabel")}
              </Text>
              <Text
                style={{
                  color: colors.brand,
                  fontSize: 34,
                  fontWeight: "900",
                  letterSpacing: 6,
                  writingDirection: "ltr",
                }}
              >
                {issuedNo}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 18 }}>
              {t("provSuccessNoHint")}
            </Text>

            <Button title={t("ok")} onPress={enterApp} style={{ alignSelf: "stretch" }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
