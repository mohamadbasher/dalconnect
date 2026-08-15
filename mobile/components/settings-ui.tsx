// The building blocks of a settings list, shared by the profile tab and the
// account-settings screen.
//
// These lived inside profile.tsx until preferences moved out of it; rather than
// copy them into the second screen, they live here so the two lists cannot
// drift into looking subtly different from each other.
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, radius, spacing } from "../lib/theme";
import { ROW, RTL_TEXT } from "../lib/rtl";

/** A quiet settings row: icon disc, label, optional trailing control, chevron. */
export function MenuRow({
  icon,
  label,
  onPress,
  danger,
  children,
  hideChevron,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  children?: React.ReactNode;
  hideChevron?: boolean;
}) {
  const { colors } = useTheme();
  const fg = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        ...ROW,
        gap: spacing.md,
        paddingVertical: 13,
        paddingHorizontal: spacing.lg,
        opacity: pressed && onPress ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.md,
          backgroundColor: danger ? colors.dangerTint : colors.brandTint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={17} color={danger ? colors.danger : colors.brand} />
      </View>
      <Text style={[RTL_TEXT, { flex: 1, color: fg, fontSize: 15, fontWeight: "600" }]}>{label}</Text>
      {children}
      {/* RTL: "back" points right, which is forward in this layout */}
      {onPress && !hideChevron ? <Ionicons name="chevron-back" size={17} color={colors.faint} /> : null}
    </Pressable>
  );
}

/** Hairline between rows, inset past the icon disc so it starts under the label. */
export function Divider() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.hairline,
        marginRight: spacing.lg + 34 + spacing.md,
        marginLeft: spacing.lg,
      }}
    />
  );
}

/** The rounded card that a run of rows sits in. */
export function SettingsGroup({ children }: { children: React.ReactNode }) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        paddingVertical: spacing.xs,
        ...shadows.card,
      }}
    >
      {children}
    </View>
  );
}

/** Compact segmented pill — the calm way to show a two/three-way choice in a row. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label?: string; icon?: keyof typeof Ionicons.glyphMap; a11y?: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={{
        ...ROW,
        gap: 2,
        backgroundColor: colors.chip,
        borderRadius: radius.full,
        padding: 3,
      }}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityLabel={o.a11y ?? o.label}
            accessibilityState={{ selected: on }}
            style={{
              ...ROW,
              gap: 5,
              paddingHorizontal: o.label ? 12 : 10,
              paddingVertical: 6,
              borderRadius: radius.full,
              backgroundColor: on ? colors.card : "transparent",
              ...(on ? shadows.card : null),
            }}
          >
            {o.icon ? <Ionicons name={o.icon} size={15} color={on ? colors.brand : colors.muted} /> : null}
            {o.label ? (
              <Text style={{ color: on ? colors.brand : colors.muted, fontSize: 12.5, fontWeight: "700" }}>
                {o.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
