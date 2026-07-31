// DalConnect shared UI kit — Dal design language, theme-aware (light/dark).
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useTheme, radius, spacing } from "../lib/theme";
import { ROW, RTL_TEXT } from "../lib/rtl";

// ---------- Button ----------
type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "success";
export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  small?: boolean;
  style?: ViewStyle;
}) {
  const { colors, shadows } = useTheme();
  const bg =
    variant === "primary" ? colors.brand
    : variant === "danger" ? colors.danger
    : variant === "success" ? colors.success
    : "transparent";
  const fg =
    variant === "outline" || variant === "ghost" ? colors.brand : colors.onBrand;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: small ? 8 : 14,
          paddingHorizontal: small ? 14 : 20,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: colors.brand,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...ROW,
          justifyContent: "center",
          gap: 8,
        },
        variant === "primary" && !isDisabled ? shadows.cta : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} size={small ? 16 : 20} color={fg} /> : null}
          <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 13 : 16 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// ---------- Input ----------
export function Input({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, fontWeight: "600" }]}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        style={[
          RTL_TEXT,
          {
            backgroundColor: colors.card,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: colors.text,
          },
          style,
        ]}
      />
      {error ? <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{error}</Text> : null}
    </View>
  );
}

// ---------- Chip ----------
export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        ...ROW,
        gap: 6,
        backgroundColor: active ? colors.brand : colors.chip,
        borderRadius: radius.full,
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={15} color={active ? colors.onBrand : colors.muted} />
      ) : null}
      <Text style={{ color: active ? colors.onBrand : colors.text, fontSize: 13, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------- Badge ----------
export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "brand" | "success" | "danger" | "gold" | "info";
}) {
  const { colors } = useTheme();
  const map = {
    neutral: { bg: colors.chip, fg: colors.muted },
    brand: { bg: colors.brandTint, fg: colors.brand },
    success: { bg: colors.successTint, fg: colors.success },
    danger: { bg: colors.dangerTint, fg: colors.danger },
    gold: { bg: colors.goldTint, fg: colors.warn },
    info: { bg: colors.infoTint, fg: colors.info },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: map.fg, fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

// ---------- Card ----------
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadows.card },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------- SectionHeader — Dal's visual signature (brand accent bar) ----------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ ...ROW, justifyContent: "space-between", marginBottom: spacing.md }}>
      <View style={{ ...ROW, gap: 8 }}>
        <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: colors.brand }} />
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{title}</Text>
      </View>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "700" }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- SearchBar ----------
export function SearchBar({
  value,
  onChangeText,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onSubmit?: () => void;
}) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={{
        ...ROW,
        gap: 8,
        backgroundColor: colors.card,
        borderRadius: radius.full,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.card,
      }}
    >
      <Ionicons name="search" size={18} color={colors.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={[RTL_TEXT, { flex: 1, fontSize: 14.5, color: colors.text, padding: 0 }]}
      />
    </View>
  );
}

// ---------- StarRating ----------
export function StarRating({
  rating,
  size = 16,
  onRate,
}: {
  rating: number;
  size?: number;
  onRate?: (r: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ ...ROW, gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onRate} onPress={() => onRate?.(i)} hitSlop={6}>
          <Ionicons
            name={rating >= i ? "star" : rating >= i - 0.5 ? "star-half" : "star-outline"}
            size={size}
            color={colors.gold}
          />
        </Pressable>
      ))}
    </View>
  );
}

// ---------- Avatar ----------
export function Avatar({ uri, name, size = 48 }: { uri?: string | null; name?: string; size?: number }) {
  const { colors } = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.chip }}
        contentFit="cover"
      />
    );
  }
  const initial = (name ?? "").trim().charAt(0) || "؟";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandTint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.brand, fontSize: size * 0.42, fontWeight: "800" }}>{initial}</Text>
    </View>
  );
}

// ---------- EmptyState ----------
export function EmptyState({
  icon = "magnify",
  title,
  subtitle,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: colors.brandTint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={icon} size={34} color={colors.brand} />
      </View>
      <Text style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13.5, textAlign: "center", paddingHorizontal: 32 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- Loading ----------
export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

export const styles = StyleSheet.create({});
