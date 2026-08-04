// Weekly availability editor — 7 rows (Sunday first), open/closed pill + from/to chips.
//
// Deliberately NO <Modal> in here (not even a transparent one): this editor is
// rendered inside screens that may themselves sit under a sheet Modal, and
// Android renders a Modal opened on top of another Modal unreliably — it can
// sit invisible until the outer one closes. An inline expanding picker that
// grows *below* the tapped row sidesteps that entirely, and it also keeps the
// row you are editing on screen.
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { ROW } from "../lib/rtl";
import { TIME_SLOTS } from "../lib/hours";

/** jsonb shape stored on professionals.working_hours — keys "0".."6", 0 = Sunday. */
export type WorkingHours = Record<string, { from: string; to: string } | null>;

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_DAY = { from: "08:00", to: "18:00" };

export function HoursEditor({
  value,
  onChange,
}: {
  value: WorkingHours;
  onChange: (next: WorkingHours) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [picker, setPicker] = useState<{ day: number; field: "from" | "to" } | null>(null);

  const patch = (day: number, next: { from: string; to: string } | null) => {
    onChange({ ...value, [String(day)]: next });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {DAYS.map((day) => {
        const cur = value[String(day)] ?? null;
        const open = !!cur;
        const openField = picker?.day === day ? picker.field : null;
        const currentSlot = openField && cur ? cur[openField] : null;

        return (
          <View key={day}>
            <View
              style={{
                ...ROW,
                gap: 10,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  width: 66,
                  fontSize: 13,
                  fontWeight: "700",
                  color: open ? colors.text : colors.faint,
                  textAlign: "right",
                }}
              >
                {t(`day${day}`)}
              </Text>

              <Pressable
                hitSlop={6}
                onPress={() => {
                  setPicker(null);
                  patch(day, open ? null : { ...DEFAULT_DAY });
                }}
                style={{
                  borderRadius: radius.full,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  backgroundColor: open ? colors.successTint : colors.dangerTint,
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "700", color: open ? colors.success : colors.danger }}
                >
                  {open ? t("openLabel") : t("closedLabel")}
                </Text>
              </Pressable>

              {cur ? (
                <View style={{ ...ROW, gap: 6, marginRight: "auto" }}>
                  {(["from", "to"] as const).map((field, i) => (
                    <React.Fragment key={field}>
                      {i === 1 ? <Text style={{ color: colors.muted, fontSize: 12 }}>–</Text> : null}
                      <Pressable
                        hitSlop={4}
                        onPress={() =>
                          setPicker(openField === field ? null : { day, field })
                        }
                        style={{
                          backgroundColor: openField === field ? colors.brand : colors.chip,
                          borderRadius: radius.sm,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: openField === field ? colors.onBrand : colors.text,
                          }}
                        >
                          {cur[field]}
                        </Text>
                      </Pressable>
                    </React.Fragment>
                  ))}
                </View>
              ) : null}
            </View>

            {/* inline slot picker — expands below the row being edited */}
            {openField && cur ? (
              <View
                style={{
                  marginTop: 6,
                  marginBottom: 2,
                  backgroundColor: colors.chip,
                  borderRadius: radius.md,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 11.5,
                    fontWeight: "700",
                    textAlign: "right",
                    paddingHorizontal: 12,
                    paddingBottom: 8,
                  }}
                >
                  {openField === "from" ? t("fromLabel") : t("toLabel")}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 8, flexDirection: "row-reverse" }}
                >
                  {TIME_SLOTS.map((slot) => {
                    const on = slot === currentSlot;
                    return (
                      <Pressable
                        key={slot}
                        onPress={() => {
                          patch(day, { ...cur, [openField]: slot });
                          setPicker(null);
                        }}
                        style={{
                          backgroundColor: on ? colors.brand : colors.card,
                          borderColor: on ? colors.brand : colors.border,
                          borderWidth: 1,
                          borderRadius: radius.full,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                        }}
                      >
                        <Text
                          style={{ fontSize: 13, fontWeight: "700", color: on ? colors.onBrand : colors.text }}
                        >
                          {slot}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
