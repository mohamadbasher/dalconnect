// DalConnect shared UI kit — Dal design language, theme-aware (light/dark).
import React from "react";
import {
  ActivityIndicator,
  Animated,
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
import { ROW, RTL_TEXT, RTL_INPUT } from "../lib/rtl";

// ---------- Press states (Dal's calibrated values) ----------
/** Tap feedback for card-sized surfaces: a real, visible push-in. */
export const pressCard: ViewStyle = { transform: [{ scale: 0.97 }], opacity: 0.9 };
/** Tap feedback for CTAs: barely-there scale so the glow doesn't jump. */
export const pressCta: ViewStyle = { opacity: 0.88, transform: [{ scale: 0.99 }] };

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
          opacity: isDisabled ? 0.5 : 1,
          ...ROW,
          justifyContent: "center",
          gap: 8,
        },
        variant === "primary" && !isDisabled ? shadows.cta : null,
        // A disabled CTA must lose the glow too — dimming only the fill while a
        // brand-coloured halo still burns underneath looks like a render bug.
        isDisabled ? { shadowOpacity: 0, elevation: 0 } : null,
        pressed && !isDisabled ? pressCta : null,
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
          RTL_INPUT,
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

// ---------- StatusPill ----------
export type Tone = "success" | "danger" | "warn" | "info" | "neutral" | "brand";

/** tone -> [tint background, foreground/dot colour] */
function useToneMap(): Record<Tone, { bg: string; fg: string }> {
  const { colors } = useTheme();
  return {
    success: { bg: colors.successTint, fg: colors.success },
    danger: { bg: colors.dangerTint, fg: colors.danger },
    warn: { bg: colors.warnTint, fg: colors.warn },
    info: { bg: colors.infoTint, fg: colors.info },
    neutral: { bg: colors.chip, fg: colors.muted },
    brand: { bg: colors.brandTint, fg: colors.brand },
  };
}

/**
 * Live-state pill: tint background + a coloured dot + bold coloured label.
 * `glow` lights the dot up (a literal halo in its own colour) for states that
 * are actively "on" — open/available/online.
 */
export function StatusPill({
  label,
  tone = "neutral",
  glow,
}: {
  label: string;
  tone?: Tone;
  glow?: boolean;
}) {
  const map = useToneMap()[tone];
  return (
    <View
      style={{
        ...ROW,
        gap: 7,
        alignSelf: "flex-start",
        backgroundColor: map.bg,
        borderRadius: radius.full,
        paddingHorizontal: 12,
        paddingVertical: 5,
      }}
    >
      <View
        style={[
          { width: 7, height: 7, borderRadius: radius.full, backgroundColor: map.fg },
          glow
            ? {
                shadowColor: map.fg,
                shadowOpacity: 0.9,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
              }
            : null,
        ]}
      />
      <Text style={{ color: map.fg, fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

// ---------- InlineNote ----------
/**
 * Tint strip that explains a state in place — use it instead of an Alert for
 * anything the user should read rather than dismiss ("your account is pending
 * review", "this booking was cancelled"). Pass `onPress` to make it a lead-in.
 */
export function InlineNote({
  tone = "info",
  icon,
  text,
  onPress,
}: {
  tone?: Tone;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
  onPress?: () => void;
}) {
  const map = useToneMap()[tone];
  const body = (
    <>
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={map.fg} /> : null}
      <Text style={[RTL_TEXT, { flex: 1, color: map.fg, fontSize: 13, fontWeight: "600", lineHeight: 19 }]}>
        {text}
      </Text>
      {onPress ? <Ionicons name="chevron-back" size={16} color={map.fg} /> : null}
    </>
  );
  const base: ViewStyle = {
    ...ROW,
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: map.bg,
    borderRadius: radius.md,
    padding: spacing.md,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed ? pressCard : null]}>
        {body}
      </Pressable>
    );
  }
  return <View style={base}>{body}</View>;
}

// ---------- Stat ----------
/**
 * Stat tile. The value shrinks to fit rather than wrapping — a four-digit
 * shekel figure wrapping onto two lines breaks the row of tiles beside it.
 */
export function Stat({
  icon,
  value,
  label,
  tone = "brand",
  style,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  label: string;
  tone?: Tone;
  style?: ViewStyle;
}) {
  const { colors, shadows } = useTheme();
  const map = useToneMap()[tone];
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
          alignItems: "center",
          gap: 6,
          ...shadows.card,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.full,
            backgroundColor: map.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name={icon} size={16} color={map.fg} />
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

// ---------- SheetHandle ----------
/** The grab handle every bottom sheet wears at its top edge. */
export function SheetHandle() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 4,
        borderRadius: radius.full,
        backgroundColor: colors.border,
        alignSelf: "center",
        marginBottom: spacing.md,
      }}
    />
  );
}

// ---------- Card ----------
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Pass to make the whole card tappable (adds Dal's push-in press state). */
  onPress?: () => void;
}) {
  const { colors, shadows } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.card,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed ? pressCard : null, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

// ---------- SectionHeader — Dal's visual signature (brand accent bar) ----------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ ...ROW, justifyContent: "space-between", marginBottom: spacing.md }}>
      <View style={{ ...ROW, gap: 8 }}>
        <View style={{ width: 4, height: 18, borderRadius: radius.full, backgroundColor: colors.brand }} />
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
        style={[RTL_INPUT, { flex: 1, fontSize: 14.5, color: colors.text, padding: 0 }]}
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

// ---------- Skeletons ----------
/** Shimmering placeholder block — use while first-loading lists/cards. */
export function Skeleton({
  width,
  height,
  radius: r = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={[
        {
          width: width ?? "100%",
          height,
          borderRadius: r,
          backgroundColor: colors.chip,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        },
        style,
      ]}
    />
  );
}

/** Card-shaped skeleton matching ProCard / BookingCard proportions. */
export function SkeletonCard() {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: 10,
        ...shadows.card,
      }}
    >
      <View style={{ ...ROW, gap: 12 }}>
        <Skeleton width={52} height={52} radius={26} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="85%" height={11} />
          <Skeleton width="40%" height={11} />
        </View>
      </View>
    </View>
  );
}

/** A list of SkeletonCards — drop-in replacement for <Loading/> on lists. */
export function SkeletonList({ count = 4 }: { count?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({});
