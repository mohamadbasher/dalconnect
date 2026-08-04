// Daily net-earnings bar graph — pure Views, no chart library.
// Short ranges (<=10 bars) stretch to fill the width; longer ranges scroll
// horizontally. A tiny floor on the fill height keeps zero days visible as a
// nub so the row never looks broken.
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme, radius } from "../lib/theme";

export type EarningsBar = { label: string; value: number };

export function EarningsBarGraph({ bars }: { bars: EarningsBar[] }) {
  const { colors } = useTheme();
  if (!bars.length) return null;

  const max = Math.max(...bars.map((b) => b.value), 1);
  const showLabels = bars.length <= 16;
  const wide = bars.length <= 10;

  const cols = bars.map((b, i) => (
    <View key={`${b.label}-${i}`} style={{ width: wide ? undefined : 20, flex: wide ? 1 : undefined, alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 18,
          height: 120,
          backgroundColor: colors.chip,
          borderRadius: radius.full,
          justifyContent: "flex-end",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: "100%",
            backgroundColor: colors.brand,
            borderRadius: radius.full,
            height: `${Math.max((b.value / max) * 100, 2)}%`,
          }}
        />
      </View>
      {showLabels ? (
        <Text numberOfLines={1} style={{ fontSize: 10, color: colors.muted }}>
          {b.label}
        </Text>
      ) : null}
    </View>
  ));

  if (wide) {
    return (
      <View
        style={{
          flexDirection: "row-reverse",
          alignItems: "flex-end",
          justifyContent: "space-between",
          height: 150,
        }}
      >
        {cols}
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row-reverse", alignItems: "flex-end", height: 150, gap: 6 }}>{cols}</View>
    </ScrollView>
  );
}
