// Provider sign in — the professionals' entrance (Dal's merchant-login model).
//
// A provider does NOT sign in with a phone: they use the six-digit number we
// issued at registration. `signIn` routes a six-digit identifier to the
// provider account, so it is the same call the customer screen makes.
import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import {
  AuthScreen,
  AuthHeaderLight,
  AuthGreeting,
  AuthCta,
  AuthLink,
  EntranceCard,
  FieldCard,
  PasswordCard,
  FormError,
  OrDivider,
} from "../../components/auth-ui";
import { useAuth } from "../../context/AuthContext";

const PROVIDER_NO = /^\d{6}$/;

export default function SignInProvider() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { signIn } = useAuth();

  const [providerNo, setProviderNo] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ providerNo?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    const no = providerNo.trim();
    if (!no) e.providerNo = t("authErrRequired");
    else if (!PROVIDER_NO.test(no)) e.providerNo = t("provErrNoFormat");
    if (!password) e.password = t("authErrRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setFormError("");
    if (!validate()) return;
    setLoading(true);
    try {
      await signIn(providerNo.trim(), password);
      // "/" decides customer vs provider once the profile loads;
      // "/(tabs)" is the CUSTOMER home and would strand every provider there.
      router.replace("/");
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      setFormError(/invalid login credentials/i.test(msg) ? t("authErrInvalidCredentials") : t("error"));
      setLoading(false);
    }
  };

  return (
    <AuthScreen light>
      <AuthHeaderLight
        compact
        roleChip={{ icon: "construct-outline", label: t("proGateTitle") }}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/sign-in"))}
      />

      {/* one tight column: greeting, two fields, action — nothing drifts apart */}
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
        <AuthGreeting title={t("provSignInTitle")} subtitle={t("provSignInTagline")} />

        <View style={{ gap: 14 }}>
          <FieldCard
            key="prov-no"
            label={t("provNoLabel")}
            icon="keypad-outline"
            value={providerNo}
            // digits only — the field is a code, not a free identifier
            onChangeText={(v) => setProviderNo(v.replace(/\D/g, "").slice(0, 6))}
            error={errors.providerNo}
            hint={t("provSignInNoHint")}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            autoCapitalize="none"
            autoCorrect={false}
            // Latin digits read as a code: centred, spaced, left-to-right
            inputStyle={{
              textAlign: "center",
              writingDirection: "ltr",
              fontSize: 18,
              fontWeight: "800",
              letterSpacing: 6,
              color: colors.brandDark,
            }}
          />
          <PasswordCard
            key="prov-pass"
            label={t("authPassword")}
            value={password}
            onChangeText={setPassword}
            error={errors.password}
          />
          <FormError message={formError} />
          <AuthCta title={t("authSignInTitle")} onPress={submit} loading={loading} />
        </View>

        <OrDivider label={t("authOr")} />

        {/* no account yet — registration is the natural next step, so it sits
            right here instead of at the bottom of a long page */}
        <EntranceCard
          icon="account-plus-outline"
          title={t("provSignUpEntry")}
          subtitle={t("provRegEntryHint")}
          onPress={() => router.push("/(auth)/register-provider")}
        />

        <AuthLink label={t("authGoCustomerSignIn")} onPress={() => router.replace("/(auth)/sign-in")} />
      </View>
    </AuthScreen>
  );
}
