// Pro earnings tab — stats tiles, commission summary, month-grouped transaction ledger.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing, formatPrice } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Button, Card, EmptyState, SectionHeader, SkeletonList } from "../../components/ui";
import { EarningsBarGraph, type EarningsBar } from "../../components/EarningsBarGraph";
import type { Transaction } from "../../lib/types";

type Row =
  | { type: "month"; key: string; label: string }
  | { type: "tx"; key: string; tx: Transaction };

export default function EarningsScreen() {
  const { colors, shadows } = useTheme();
  const { t, lang, loc } = useI18n();
  const { session, isPro, professional } = useAuth();
  const router = useRouter();
  const uid = session?.user?.id ?? null;

  const [txs, setTxs] = useState<Transaction[]>([]);
  const [jobsCompleted, setJobsCompleted] = useState(professional?.jobs_completed ?? 0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const [{ data: txData }, { data: proData }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*, booking:bookings(*, category:categories(*))")
          .eq("professional_id", uid)
          .order("created_at", { ascending: false }),
        supabase.from("professionals").select("jobs_completed").eq("id", uid).maybeSingle(),
      ]);
      setTxs((txData as unknown as Transaction[]) ?? []);
      if (proData?.jobs_completed != null) setJobsCompleted(proData.jobs_completed as number);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const { totalNet, monthNet, monthTxCount, totalCommission, rows } = useMemo(() => {
    const now = new Date();
    let total = 0;
    let month = 0;
    let monthCount = 0;
    let comm = 0;
    const out: Row[] = [];
    let lastMonthKey = "";
    for (const tx of txs) {
      total += Number(tx.net);
      comm += Number(tx.commission);
      const d = new Date(tx.created_at);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        month += Number(tx.net);
        monthCount += 1;
      }
      const mKey = `${d.getFullYear()}-${d.getMonth()}`;
      if (mKey !== lastMonthKey) {
        lastMonthKey = mKey;
        out.push({
          type: "month",
          key: `m-${mKey}`,
          label: d.toLocaleDateString(lang === "ar" ? "ar" : "he-IL", { month: "long", year: "numeric" }),
        });
      }
      out.push({ type: "tx", key: tx.id, tx });
    }
    return { totalNet: total, monthNet: month, monthTxCount: monthCount, totalCommission: comm, rows: out };
  }, [txs, lang]);

  // last 7 days of net earnings (oldest -> newest; the graph lays out RTL itself)
  const { weekBars, weekTotal } = useMemo(() => {
    const locale = lang === "ar" ? "ar" : "he-IL";
    const byDay = new Map<string, number>();
    for (const tx of txs) {
      const d = new Date(tx.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      byDay.set(key, (byDay.get(key) ?? 0) + Number(tx.net));
    }
    const out: EarningsBar[] = [];
    let sum = 0;
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const value = byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? 0;
      sum += value;
      out.push({
        label: d.toLocaleDateString(locale, { weekday: "narrow" }),
        value,
      });
    }
    return { weekBars: out, weekTotal: sum };
  }, [txs, lang]);

  if (!isPro || !professional || !uid) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg }}>
        <EmptyState icon="briefcase-outline" title={t("proGateTitle")} subtitle={t("proGateSubtitle")} />
        <Button title={t("proGateCta")} icon="briefcase-plus" onPress={() => router.push("/become-pro")} />
      </View>
    );
  }

  if (loading) return <SkeletonList count={4} />;

  const StatTile = ({
    label,
    value,
    icon,
    big,
  }: {
    label: string;
    value: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    big?: boolean;
  }) => (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.sm,
        gap: 5,
        alignItems: "center",
        ...shadows.card,
        ...(big ? { borderWidth: 1.5, borderColor: colors.brandTint } : null),
      }}
    >
      <MaterialCommunityIcons name={icon} size={16} color={big ? colors.brand : colors.muted} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: big ? colors.brand : colors.text, fontSize: big ? 22 : 19, fontWeight: "800" }}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );

  const header = (
    <View style={{ gap: spacing.lg, marginBottom: spacing.md }}>
      {txs.length ? (
        <Card style={{ gap: spacing.md }}>
          <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800" }]}>
              {t("last7DaysTitle")}
            </Text>
            <Text style={{ color: colors.brand, fontSize: 13.5, fontWeight: "800" }}>
              {t("last7DaysTotal", { amount: formatPrice(weekTotal) })}
            </Text>
          </View>
          <EarningsBarGraph bars={weekBars} />
        </Card>
      ) : null}

      <View style={{ ...ROW, gap: spacing.md, alignItems: "stretch" }}>
        <StatTile label={t("totalNet")} value={formatPrice(totalNet)} icon="cash-multiple" big />
        <StatTile label={t("thisMonthNet")} value={formatPrice(monthNet)} icon="calendar-month-outline" />
        <StatTile label={t("jobsCompleted")} value={String(jobsCompleted)} icon="check-decagram-outline" />
      </View>

      {txs.length > 0 && monthTxCount === 0 ? (
        <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{t("noEarningsThisMonth")}</Text>
      ) : null}

      <Card style={{ gap: 6 }}>
        <View style={{ ...ROW, gap: 8 }}>
          <MaterialCommunityIcons name="bank-outline" size={18} color={colors.warn} />
          <Text style={[RTL_TEXT, { color: colors.text, fontSize: 13.5, fontWeight: "700", flexShrink: 1 }]}>
            {t("commissionOwed", { amount: formatPrice(totalCommission) })}
          </Text>
        </View>
        <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 12 }]}>{t("commissionExplainer")}</Text>
      </Card>

      {rows.length ? <SectionHeader title={t("historyTitle")} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 }}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon="cash-multiple" title={t("noEarnings")} subtitle={t("noEarningsHint")} />}
        renderItem={({ item }) => {
          if (item.type === "month") {
            return (
              <Text
                style={[
                  RTL_TEXT,
                  {
                    color: colors.muted,
                    fontSize: 12.5,
                    fontWeight: "800",
                    marginTop: spacing.md,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                {item.label}
              </Text>
            );
          }
          const tx = item.tx;
          const cat = tx.booking?.category;
          const title = cat ? loc(cat, "name") : tx.booking?.title || t("category");
          return (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.sm,
                gap: 6,
                ...shadows.card,
              }}
            >
              <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                <View style={{ ...ROW, gap: 8, flexShrink: 1 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: radius.md,
                      backgroundColor: colors.brandTint,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialCommunityIcons name={(cat?.icon as any) ?? "tools"} size={18} color={colors.brand} />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.text, fontSize: 13.5, fontWeight: "700" }]}>
                      {title}
                    </Text>
                    <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 11.5 }]}>
                      {new Date(tx.created_at).toLocaleDateString(lang === "ar" ? "ar" : "he-IL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.success, fontSize: 16, fontWeight: "800" }}>
                  {formatPrice(tx.net)}
                </Text>
              </View>
              <View style={{ ...ROW, justifyContent: "flex-start", gap: 12 }}>
                <View style={{ ...ROW, gap: 4 }}>
                  <Ionicons name="cash-outline" size={12} color={colors.faint} />
                  <Text style={{ color: colors.faint, fontSize: 11.5 }}>{formatPrice(tx.amount)}</Text>
                </View>
                <Text style={{ color: colors.faint, fontSize: 11.5 }}>
                  {t("commission")}: -{formatPrice(tx.commission)}
                </Text>
              </View>
            </View>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      />
    </View>
  );
}
