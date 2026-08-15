// Pro earnings tab — one summary card, the 7-day graph, commission note, ledger.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, TextStyle, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, radius, spacing, formatPrice } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { ROW, RTL_TEXT } from "../../lib/rtl";
import { Button, Card, EmptyState, SectionHeader, SkeletonList } from "../../components/ui";
import { EarningsBarGraph, type EarningsBar } from "../../components/EarningsBarGraph";
import type { Transaction } from "../../lib/types";

/** Shekel amounts are Latin digits — keep them LTR inside the RTL layout. */
const LTR: TextStyle = { writingDirection: "ltr" };

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
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
          padding: spacing.lg,
          gap: spacing.lg,
        }}
      >
        <EmptyState icon="briefcase-outline" title={t("proGateTitle")} subtitle={t("proGateSubtitle")} />
      </View>
    );
  }

  if (loading) return <SkeletonList count={4} />;

  const header = (
    <View style={{ gap: spacing.lg, marginBottom: spacing.md }}>
      {/* ---------- the number that matters, then two quiet ones ---------- */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ alignItems: "center", gap: 4, paddingVertical: spacing.xl }}>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{t("totalNet")}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[LTR, { color: colors.brand, fontSize: 34, fontWeight: "800" }]}
          >
            {formatPrice(totalNet)}
          </Text>
        </View>
        <View style={{ ...ROW, borderTopWidth: 1, borderTopColor: colors.hairline }}>
          {[
            { key: "month", label: t("thisMonthNet"), value: formatPrice(monthNet) },
            { key: "jobs", label: t("jobsCompleted"), value: String(jobsCompleted) },
          ].map((s, i) => (
            <View
              key={s.key}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 3,
                paddingVertical: spacing.md,
                borderLeftWidth: i === 0 ? 1 : 0,
                borderLeftColor: colors.hairline,
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[LTR, { color: colors.text, fontSize: 17, fontWeight: "800" }]}
              >
                {s.value}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* ---------- last 7 days ---------- */}
      {txs.length ? (
        <Card style={{ gap: spacing.md }}>
          <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800" }]}>
              {t("last7DaysTitle")}
            </Text>
            {/* "المجموع: ₪1,234" — Arabic label with a Latin amount: RTL text, LTR digit run */}
            <Text style={[RTL_TEXT, { color: colors.brand, fontSize: 13.5, fontWeight: "800" }]}>
              {t("last7DaysTotal", { amount: formatPrice(weekTotal) })}
            </Text>
          </View>
          <EarningsBarGraph bars={weekBars} />
        </Card>
      ) : null}

      {txs.length > 0 && monthTxCount === 0 ? (
        <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12.5, lineHeight: 19 }]}>
          {t("noEarningsThisMonth")}
        </Text>
      ) : null}

      {/* ---------- commission owed — a quiet tint strip, not another boxed card ---------- */}
      <View
        style={{
          ...ROW,
          gap: 10,
          alignItems: "flex-start",
          backgroundColor: colors.warnTint,
          borderRadius: radius.md,
          padding: spacing.md,
        }}
      >
        <MaterialCommunityIcons name="bank-outline" size={18} color={colors.warn} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[RTL_TEXT, { color: colors.warn, fontSize: 13.5, fontWeight: "700" }]}>
            {t("commissionOwed", { amount: formatPrice(totalCommission) })}
          </Text>
          <Text style={[RTL_TEXT, { color: colors.warn, fontSize: 12, opacity: 0.85 }]}>
            {t("commissionExplainer")}
          </Text>
        </View>
      </View>

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
        showsVerticalScrollIndicator={false}
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
                gap: 8,
                ...shadows.card,
              }}
            >
              <View style={{ ...ROW, justifyContent: "space-between", gap: 8 }}>
                <View style={{ ...ROW, gap: 10, flexShrink: 1 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      backgroundColor: colors.brandTint,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialCommunityIcons name={(cat?.icon as any) ?? "tools"} size={18} color={colors.brand} />
                  </View>
                  <View style={{ flexShrink: 1, gap: 2 }}>
                    <Text
                      numberOfLines={1}
                      style={[RTL_TEXT, { color: colors.text, fontSize: 14, fontWeight: "700" }]}
                    >
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
                <Text style={[LTR, { color: colors.success, fontSize: 16, fontWeight: "800" }]}>
                  {formatPrice(tx.net)}
                </Text>
              </View>

              {/* gross and the platform's cut, kept quiet under the net figure */}
              <View style={{ ...ROW, gap: 14, flexWrap: "wrap" }}>
                <View style={{ ...ROW, gap: 5 }}>
                  <Text style={{ color: colors.faint, fontSize: 11.5 }}>{t("grossAmount")}</Text>
                  <Text style={[LTR, { color: colors.muted, fontSize: 11.5, fontWeight: "600" }]}>
                    {formatPrice(tx.amount)}
                  </Text>
                </View>
                <View style={{ ...ROW, gap: 5 }}>
                  <Text style={{ color: colors.faint, fontSize: 11.5 }}>{t("commission")}</Text>
                  <Text style={[LTR, { color: colors.muted, fontSize: 11.5, fontWeight: "600" }]}>
                    {`−${formatPrice(tx.commission)}`}
                  </Text>
                </View>
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
