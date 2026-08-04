// Lightweight month-grid date picker — ported from Dal's CalendarModal.
// Zero native deps, theme-aware, Arabic + Hebrew month/weekday names.
// Chevrons are reversed for RTL: "chevron-forward" walks to the PREVIOUS month.
import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import type { Lang } from "../lib/types";

const MONTHS: Record<Lang, string[]> = {
  ar: [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ],
  he: [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ],
};

// index 0 = Sunday
const WEEK: Record<Lang, string[]> = {
  ar: ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"],
  he: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
};

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function CalendarModal({
  visible,
  value,
  onSelect,
  onClose,
  title,
  minDate,
  maxDate,
}: {
  visible: boolean;
  value: Date | null;
  onSelect: (d: Date) => void;
  onClose: () => void;
  title?: string;
  minDate?: Date;
  maxDate?: Date;
}) {
  const { colors, shadows } = useTheme();
  const { lang } = useI18n();

  const init = value ?? new Date();
  const [ym, setYm] = useState({ y: init.getFullYear(), m: init.getMonth() });

  // re-open on the month of the current selection (or this month when empty)
  useEffect(() => {
    if (!visible) return;
    const base = value ?? new Date();
    setYm({ y: base.getFullYear(), m: base.getMonth() });
  }, [visible, value]);

  const first = new Date(ym.y, ym.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(ym.y, ym.m, d));

  const move = (delta: number) => {
    setYm((prev) => {
      let m = prev.m + delta;
      let y = prev.y;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
      if (m > 11) {
        m = 0;
        y += 1;
      }
      return { y, m };
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay }}
        onPress={onClose}
      />
      <View
        pointerEvents="box-none"
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: 10,
            ...shadows.float,
          }}
        >
          {title ? (
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" }}>{title}</Text>
          ) : null}

          {/* month nav — RTL: forward chevron goes back in time */}
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 6,
            }}
          >
            <Pressable onPress={() => move(-1)} hitSlop={12}>
              <Ionicons name="chevron-forward" size={24} color={colors.brand} />
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              {MONTHS[lang][ym.m]} {ym.y}
            </Text>
            <Pressable onPress={() => move(1)} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={colors.brand} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row-reverse" }}>
            {WEEK[lang].map((w) => (
              <Text
                key={w}
                style={{ flex: 1, textAlign: "center", fontSize: 12, color: colors.muted, fontWeight: "700" }}
              >
                {w}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap" }}>
            {cells.map((d, i) => {
              if (!d) return <View key={`pad-${i}`} style={{ width: "14.28%", aspectRatio: 1 }} />;
              const disabled =
                (!!maxDate && startOfDay(d) > startOfDay(maxDate)) ||
                (!!minDate && startOfDay(d) < startOfDay(minDate));
              const selected = !!value && sameDay(d, value);
              const isToday = !selected && sameDay(d, today);
              return (
                <Pressable
                  key={d.toISOString()}
                  disabled={disabled}
                  onPress={() => onSelect(d)}
                  style={{ width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.full,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? colors.brand : "transparent",
                      borderWidth: isToday ? 1 : 0,
                      borderColor: colors.brand,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: selected ? colors.onBrand : disabled ? colors.border : colors.text,
                      }}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
