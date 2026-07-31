// Shared layout + fields for the sign-in / sign-up screens so they share one
// centered, modern design. No top header — the brand badge sits in the middle.
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme, spacing } from "../lib/theme";
import { RTL_TEXT } from "../lib/rtl";
import { Input } from "./ui";

/** Brand badge + "DalConnect" wordmark, centered. */
export function AuthBrand({ subtitle }: { subtitle?: string }) {
  const { colors, shadows } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      <LinearGradient
        colors={[colors.brand, colors.brandDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 88,
          height: 88,
          borderRadius: 26,
          alignItems: "center",
          justifyContent: "center",
          ...shadows.cta,
        }}
      >
        <MaterialCommunityIcons name="hammer-wrench" size={42} color="#ffffff" />
      </LinearGradient>
      <Text
        style={{
          color: colors.text,
          fontSize: 26,
          fontWeight: "800",
          writingDirection: "ltr",
          letterSpacing: 0.3,
        }}
      >
        DalConnect
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.muted, fontSize: 14.5, textAlign: "center" }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

/** Vertically-centered scroll shell shared by both auth screens. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: spacing.xl,
            gap: spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Password input with a show/hide eye toggle. */
export function PasswordField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, fontWeight: "600" }]}>{label}</Text>
      <View style={{ justifyContent: "center" }}>
        <Input
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          placeholder={placeholder}
          style={{ paddingLeft: 46 }}
        />
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} style={{ position: "absolute", left: 14 }}>
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.faint} />
        </Pressable>
      </View>
      {error ? <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{error}</Text> : null}
    </View>
  );
}

/** Inline form-level error row. */
export function FormError({ message }: { message: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm }}>
      <Ionicons name="alert-circle" size={17} color={colors.danger} />
      <Text style={[RTL_TEXT, { flex: 1, color: colors.danger, fontSize: 13, fontWeight: "600" }]}>
        {message}
      </Text>
    </View>
  );
}
