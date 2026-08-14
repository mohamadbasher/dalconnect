// Shared chrome for the pre-login screens — Dal's auth design: a full-bleed
// brand gradient hero with a floating white sheet pulled up over it.
//
// The hero is the one sanctioned place where white is hardcoded: it is painted
// on the brand gradient, so `colors.text` (near-black) would be unreadable.
// Everything inside the sheet uses theme tokens.
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme, radius, spacing, brandGradientProps, brandGradientBrightProps } from "../lib/theme";
import { ROW, RTL_TEXT, RTL_INPUT } from "../lib/rtl";

/** White-on-brand ink for the hero (see file header). */
const HERO_INK = "#ffffff";
const HERO_INK_SOFT = "rgba(255,255,255,0.85)";
const HERO_GLASS = "rgba(255,255,255,0.18)";
const HERO_GLASS_EDGE = "rgba(255,255,255,0.35)";

/**
 * Scroll shell shared by every auth screen: brand-coloured backdrop (so the
 * bounce above the hero stays brand, never white) + the keyboard handling the
 * long forms need — the sheet insets itself for the keyboard and the last
 * control can always be scrolled clear of it.
 */
export function AuthScreen({ children, light }: { children: React.ReactNode; light?: boolean }) {
  const { colors } = useTheme();
  return (
    // A `light` screen is white behind the form — the warmth belongs to the
    // header alone. Tinting the whole screen is what made this look washed out.
    <View style={{ flex: 1, backgroundColor: light ? colors.card : colors.brand }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Brand gradient hero: round glass badge, title, tagline, and an optional back
 * button. RTL — the back button sits on the start (right) edge and points
 * forward (right), the direction "back" actually is in an RTL layout.
 */
export function AuthHero({
  title,
  tagline,
  icon = "hammer-wrench",
  onBack,
  ltrTitle,
}: {
  title: string;
  tagline?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onBack?: () => void;
  /** Set for the Latin brand name so it never picks up RTL ordering. */
  ltrTitle?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      {...brandGradientProps}
      style={{ paddingTop: insets.top + 26, paddingBottom: 46, alignItems: "center", overflow: "hidden" }}
    >
      {/* the hero owns the top of the screen, so the bar has to go light */}
      <StatusBar style="light" />

      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => ({
            position: "absolute",
            right: 14,
            top: insets.top + 6,
            width: 38,
            height: 38,
            borderRadius: radius.full,
            backgroundColor: HERO_GLASS,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="arrow-forward" size={20} color={HERO_INK} />
        </Pressable>
      ) : null}

      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 24,
          backgroundColor: HERO_GLASS,
          borderWidth: 1,
          borderColor: HERO_GLASS_EDGE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={icon} size={38} color={HERO_INK} />
      </View>

      <Text
        style={{
          color: HERO_INK,
          fontSize: ltrTitle ? 26 : 21,
          fontWeight: "800",
          marginTop: 12,
          textAlign: "center",
          paddingHorizontal: 30,
          ...(ltrTitle ? { writingDirection: "ltr" as const, letterSpacing: 0.3 } : null),
        }}
      >
        {title}
      </Text>
      {tagline ? (
        <Text
          style={{
            color: HERO_INK_SOFT,
            fontSize: 13,
            marginTop: 4,
            textAlign: "center",
            paddingHorizontal: 32,
            lineHeight: 19,
          }}
        >
          {tagline}
        </Text>
      ) : null}
    </LinearGradient>
  );
}

/** The white sheet that floats over the hero, with its grab handle. */
export function AuthSheet({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flexGrow: 1,
          backgroundColor: colors.card,
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          marginTop: -26,
          paddingHorizontal: 24,
          paddingTop: 22,
          // generous tail so the CTA clears the keyboard and the home bar
          paddingBottom: 28 + insets.bottom,
        },
        style,
      ]}
    >
      <View
        style={{
          alignSelf: "center",
          width: 44,
          height: 4,
          borderRadius: radius.full,
          backgroundColor: colors.border,
          marginBottom: 18,
        }}
      />
      {children}
    </View>
  );
}

/** Segmented pill switching between the two halves of a flow. */
export function AuthTabs<K extends string>({
  value,
  options,
  onChange,
}: {
  value: K;
  options: { key: K; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  onChange: (key: K) => void;
}) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row-reverse",
        backgroundColor: colors.card,
        borderRadius: radius.full,
        padding: 5,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.card,
      }}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => (on ? undefined : onChange(o.key))}
            style={[
              {
                flex: 1,
                ...ROW,
                justifyContent: "center",
                gap: 7,
                paddingVertical: 13,
                borderRadius: radius.full,
              },
              on ? { backgroundColor: colors.brand, ...shadows.cta } : null,
            ]}
          >
            {o.icon ? (
              <Ionicons name={o.icon} size={17} color={on ? colors.onBrand : colors.muted} />
            ) : null}
            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: on ? colors.onBrand : colors.muted,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Labelled input row with a leading Ionicon and an optional trailing control. */
export function IconInput({
  label,
  icon,
  error,
  hint,
  trailing,
  inputStyle,
  style,
  ...props
}: TextInputProps & {
  label?: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  /** Small muted line under the field (e.g. what the six-digit number is). */
  hint?: string;
  trailing?: React.ReactNode;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      {label ? (
        <Text style={[RTL_TEXT, { fontSize: 13, fontWeight: "700", color: colors.text }]}>{label}</Text>
      ) : null}
      <View
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          gap: 10,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: 15,
          paddingHorizontal: 15,
        }}
      >
        <Ionicons name={icon} size={18} color={error ? colors.danger : colors.faint} />
        <TextInput
          placeholderTextColor={colors.faint}
          {...props}
          style={[
            RTL_INPUT,
            { flex: 1, paddingVertical: 15, fontSize: 15, color: colors.text },
            inputStyle,
            style,
          ]}
        />
        {trailing}
      </View>
      {hint ? (
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 11.5, lineHeight: 17 }]}>{hint}</Text>
      ) : null}
      {error ? <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{error}</Text> : null}
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
    <IconInput
      label={label}
      icon="lock-closed-outline"
      value={value}
      onChangeText={onChangeText}
      error={error}
      placeholder={placeholder}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10}>
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.faint} />
        </Pressable>
      }
    />
  );
}

/** Form-level error — an inline box, never an Alert. */
export function FormError({ message }: { message: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: colors.dangerTint,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Ionicons name="alert-circle" size={16} color={colors.danger} />
      <Text style={{ flex: 1, color: colors.danger, fontSize: 13, fontWeight: "600", textAlign: "right" }}>
        {message}
      </Text>
    </View>
  );
}

/** The screen's primary action — brand fill, glow, trailing forward arrow. */
export function AuthCta({
  title,
  onPress,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors, shadows } = useTheme();
  const off = loading || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        { borderRadius: 18, marginTop: 4, opacity: off ? 0.6 : 1 },
        shadows.cta,
        off ? { shadowOpacity: 0, elevation: 0 } : null,
        pressed && !off ? { opacity: 0.9, transform: [{ scale: 0.99 }] } : null,
      ]}
    >
      {/* the gradient gives the button the same depth as the brand mark */}
      <LinearGradient
        {...brandGradientBrightProps}
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 18,
          paddingVertical: 18,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.onBrand} />
        ) : (
          <>
            <Text style={{ color: colors.onBrand, fontSize: 16, fontWeight: "800" }}>{title}</Text>
            {/* RTL: forward is leftward */}
            <Ionicons name="arrow-back" size={18} color={colors.onBrand} />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/** Quiet text link ("already have an account?"). */
export function AuthLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: colors.brand, fontSize: 14, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Cross-role footer: hairline, a muted hint, then an outlined button — the way
 * Dal hands a merchant off from the customer form.
 */
export function AuthFooter({
  hint,
  action,
  icon,
  onPress,
}: {
  /** Optional — omit when the button alone says enough. */
  hint?: string;
  action: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg, gap: 10 }}>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      {hint ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", lineHeight: 19, marginTop: 6 }}>
          {hint}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            ...ROW,
            justifyContent: "center",
            gap: 8,
            backgroundColor: colors.card,
            borderWidth: 1.5,
            borderColor: colors.brand,
            borderRadius: 14,
            paddingVertical: 15,
          },
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={19} color={colors.brand} /> : null}
        <Text style={{ color: colors.brand, fontWeight: "800", fontSize: 15 }}>{action}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Light auth style — a warm, welcoming header instead of the dark gradient.
// ---------------------------------------------------------------------------

/**
 * Soft peach-to-white header with the brand mark.
 *
 * The reference design sits on a blurred room photo; there is no such asset in
 * the project, so the warmth comes from a gradient instead — same feel, nothing
 * to ship.
 */
export function AuthHeaderLight({ tagline }: { tagline?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      // warm at the top, resolving to the card colour so the form below reads
      // as one continuous surface rather than a peach panel
      colors={["#fbe3d1", "#fdf0e6", "#fffaf6", colors.card]}
      locations={[0, 0.45, 0.78, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ paddingTop: insets.top + 30, paddingBottom: 30, alignItems: "center", overflow: "hidden" }}
    >
      <StatusBar style="dark" />

      {/* Soft light blooms. The reference sits on a photo of a warm room; these
          stand in for that glow so the header has depth instead of a flat wash. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -70,
          right: -50,
          width: 230,
          height: 230,
          borderRadius: 115,
          backgroundColor: "rgba(255,255,255,0.55)",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 10,
          left: -80,
          width: 210,
          height: 210,
          borderRadius: 105,
          backgroundColor: "rgba(255,196,144,0.30)",
        }}
      />

      {/* halo behind the mark, so the tile sits in light rather than on top of it */}
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 148,
            height: 148,
            borderRadius: 74,
            backgroundColor: "rgba(226,130,68,0.14)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 116,
            height: 116,
            borderRadius: 58,
            backgroundColor: "rgba(226,130,68,0.16)",
          }}
        />
        <LinearGradient
          {...brandGradientBrightProps}
          style={{
            width: 94,
            height: 94,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.brand,
            shadowOpacity: 0.45,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
          }}
        >
          <MaterialCommunityIcons name="hammer-wrench" size={44} color="#ffffff" />
        </LinearGradient>
      </View>

      {/* two-tone wordmark — always Latin, in both languages */}
      <Text
        style={{
          marginTop: 18,
          fontSize: 33,
          fontWeight: "800",
          writingDirection: "ltr",
          letterSpacing: -0.2,
          color: colors.text,
        }}
      >
        Dal<Text style={{ color: colors.brand }}>Connect</Text>
      </Text>

      {tagline ? (
        <View style={{ ...ROW, gap: 12, marginTop: 10, paddingHorizontal: 40, alignSelf: "stretch" }}>
          <View style={{ flex: 1, height: 1, backgroundColor: "rgba(28,25,23,0.10)" }} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>{tagline}</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "rgba(28,25,23,0.10)" }} />
        </View>
      ) : null}
    </LinearGradient>
  );
}

/** Big greeting + subtitle + a short brand rule under it. */
export function AuthGreeting({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: "800", textAlign: "center" }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>{subtitle}</Text>
      ) : null}
      <View
        style={{
          width: 46,
          height: 3,
          borderRadius: radius.full,
          backgroundColor: colors.brand,
          marginTop: 6,
        }}
      />
    </View>
  );
}

/**
 * Input presented as a card: the label sits inside, above the value, with the
 * icon held apart on the far side by a hairline.
 */
export function FieldCard({
  label,
  icon,
  error,
  hint,
  trailing,
  inputStyle,
  ...props
}: TextInputProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  hint?: string;
  trailing?: React.ReactNode;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const { colors, shadows } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          ...ROW,
          gap: 14,
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          paddingHorizontal: 16,
          paddingVertical: 13,
          ...shadows.card,
        }}
      >
        {/* label + value stack (right side in RTL) */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5 }]}>{label}</Text>
          <View style={{ ...ROW, gap: 10, alignItems: "center" }}>
            <TextInput
              placeholderTextColor={colors.faint}
              {...props}
              style={[
                RTL_INPUT,
                { flex: 1, fontSize: 16, color: colors.text, padding: 0, minHeight: 24 },
                inputStyle,
              ]}
            />
            {trailing}
          </View>
        </View>

        {/* short rule, not a full-height wall — it only has to separate */}
        <View style={{ width: 1, height: 30, backgroundColor: colors.hairline }} />
        <Ionicons name={icon} size={22} color={error ? colors.danger : colors.faint} />
      </View>

      {error ? (
        <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{error}</Text>
      ) : hint ? (
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 11.5, lineHeight: 17 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** FieldCard with the show/hide eye. */
export function PasswordCard({
  label,
  error,
  hint,
  inputStyle,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <FieldCard
      label={label}
      icon="lock-closed-outline"
      error={error}
      hint={hint}
      inputStyle={inputStyle}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoComplete="off"
      trailing={
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10}>
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.faint} />
        </Pressable>
      }
      {...props}
    />
  );
}

/** "or" rule between the primary action and the alternative one. */
export function OrDivider({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ ...ROW, gap: 12, marginTop: spacing.lg }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
