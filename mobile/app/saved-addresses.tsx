// Saved addresses — the places a customer orders to again and again.
//
// Home services go to the same few places, so re-typing the street and
// re-picking the city on every request is the most repeated friction in the
// flow — and the step most likely to be got wrong in a hurry, which then routes
// the request to the wrong city's professionals.
//
// One list, one sheet to add or edit. The default address is the one
// create-booking pre-fills, so it is the only state worth showing on a row.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchCities } from "../lib/refdata";
import { getCurrentPosition } from "../lib/location";
import { ROW, RTL_TEXT } from "../lib/rtl";
import { Button, EmptyState, Input, Loading, SearchBar, SheetHandle, pressCard } from "../components/ui";
import { useToast } from "../components/Toast";
import type { City, SavedAddress } from "../lib/types";

export default function SavedAddressesScreen() {
  const { colors, shadows } = useTheme();
  const { t, loc } = useI18n();
  const { session } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = session?.user?.id;

  const [items, setItems] = useState<SavedAddress[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  // the add/edit sheet
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [cityId, setCityId] = useState<number | null>(null);
  const [street, setStreet] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ label?: string; city?: string }>({});
  const [cityModal, setCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from("saved_addresses")
      .select("*, city:cities(*)")
      .eq("user_id", uid)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data as SavedAddress[]) ?? []);
  }, [uid]);

  useEffect(() => {
    Promise.all([load(), fetchCities().then(setCities).catch(() => {})]).finally(() => setLoading(false));
  }, [load]);

  const openSheet = (a: SavedAddress | null) => {
    setEditing(a);
    setLabel(a?.label ?? "");
    setCityId(a?.city_id ?? null);
    setStreet(a?.address ?? "");
    setCoords(a?.lat != null && a?.lng != null ? { lat: a.lat, lng: a.lng } : null);
    // Editing the current default shouldn't offer to "make it default" — it is.
    setMakeDefault(a ? a.is_default : items.length === 0);
    setErrors({});
    setSheetOpen(true);
  };

  /** nearest city to a point — same maths as create-booking */
  const nearestCity = (lat: number, lng: number): City | null => {
    const k = Math.cos((lat * Math.PI) / 180);
    let best: City | null = null;
    let bestD = Infinity;
    for (const c of cities) {
      if (c.lat == null || c.lng == null) continue;
      const dy = c.lat - lat;
      const dx = (c.lng - lng) * k;
      const d = dy * dy + dx * dx;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  };

  const useMyLocation = async () => {
    setLocating(true);
    const pos = await getCurrentPosition();
    setLocating(false);
    if (!pos) {
      toast.error(t("locationFailed"));
      return;
    }
    setCoords(pos);
    const city = nearestCity(pos.lat, pos.lng);
    if (city) {
      setCityId(city.id);
      setErrors((e) => ({ ...e, city: undefined }));
      toast.success(t("locationNearestCity", { city: loc(city, "name") }));
    }
    Haptics.selectionAsync().catch(() => {});
  };

  const save = async () => {
    if (!uid || saving) return;
    const errs: typeof errors = {};
    if (!label.trim()) errs.label = t("addrLabelRequired");
    if (cityId === null) errs.city = t("addrCityRequired");
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const row = {
      user_id: uid,
      label: label.trim(),
      city_id: cityId,
      address: street.trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      is_default: makeDefault,
    };
    const { error } = editing
      ? await supabase.from("saved_addresses").update(row).eq("id", editing.id)
      : await supabase.from("saved_addresses").insert(row);
    setSaving(false);
    if (error) {
      toast.error(t("error"));
      return;
    }
    setSheetOpen(false);
    toast.success(t("addrSaved"));
    load();
  };

  const remove = async (a: SavedAddress) => {
    const { error } = await supabase.from("saved_addresses").delete().eq("id", a.id);
    if (error) {
      toast.error(t("error"));
      return;
    }
    toast.info(t("addrDeleted"));
    load();
  };

  const setDefault = async (a: SavedAddress) => {
    if (a.is_default) return;
    const { error } = await supabase.from("saved_addresses").update({ is_default: true }).eq("id", a.id);
    if (error) {
      toast.error(t("error"));
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    load();
  };

  const selectedCity = cities.find((c) => c.id === cityId) ?? null;
  const filteredCities = useMemo(() => {
    const q = citySearch.trim();
    if (!q) return cities;
    return cities.filter((c) => c.name_ar.includes(q) || c.name_he.includes(q));
  }, [cities, citySearch]);

  const suggestions = [t("addrSuggestHome"), t("addrSuggestWork"), t("addrSuggestFamily")];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          ...ROW,
          gap: spacing.md,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
          {t("addrTitle")}
        </Text>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState icon="map-marker-plus-outline" title={t("addrEmptyTitle")} subtitle={t("addrEmptySubtitle")} />
          }
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                padding: spacing.md,
                gap: spacing.sm,
                borderWidth: 1.5,
                borderColor: item.is_default ? colors.brand : "transparent",
                ...shadows.card,
              }}
            >
              <View style={{ ...ROW, alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: colors.brandTint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="location" size={19} color={colors.brand} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ ...ROW, alignItems: "center", gap: 6 }}>
                    <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15, fontWeight: "800" }]}>
                      {item.label}
                    </Text>
                    {item.is_default ? (
                      <View
                        style={{
                          backgroundColor: colors.brandTint,
                          borderRadius: radius.full,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ color: colors.brand, fontSize: 10.5, fontWeight: "800" }}>
                          {t("addrDefaultBadge")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={[RTL_TEXT, { color: colors.muted, fontSize: 12.5 }]}>
                    {[item.city ? loc(item.city, "name") : null, item.address || null].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: colors.hairline }} />

              <View style={{ ...ROW, alignItems: "center", gap: spacing.lg }}>
                {!item.is_default ? (
                  <Pressable onPress={() => setDefault(item)} hitSlop={6}>
                    <Text style={{ color: colors.brand, fontSize: 12.5, fontWeight: "700" }}>
                      {t("addrSetDefault")}
                    </Text>
                  </Pressable>
                ) : null}
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => openSheet(item)} hitSlop={6}>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => remove(item)} hitSlop={6}>
                  <Text style={{ color: colors.danger, fontSize: 12.5, fontWeight: "700" }}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
        }}
      >
        <Button title={t("addrAdd")} icon="plus" onPress={() => openSheet(null)} />
      </View>

      {/* add / edit sheet.
          KeyboardAvoidingView is load-bearing: a bottom sheet sits ON the
          keyboard's half of the screen, so without it the keyboard opens
          straight over the fields and you type blind. */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setSheetOpen(false)} />
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              maxHeight: "88%",
              padding: spacing.lg,
              // The keyboard already covers the home indicator when it's up, so
              // adding the safe-area inset on top of it strands the save button
              // behind the keyboard.
              paddingBottom: spacing.lg,
              gap: spacing.md,
            }}
          >
            <SheetHandle />
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>
              {editing ? t("addrEdit") : t("addrAdd")}
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
              <Input
                label={t("addrLabel")}
                placeholder={t("addrLabelPlaceholder")}
                value={label}
                onChangeText={(v) => {
                  setLabel(v);
                  if (v.trim()) setErrors((e) => ({ ...e, label: undefined }));
                }}
                error={errors.label}
                maxLength={40}
              />
              {/* the three names almost everyone uses, one tap away */}
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: spacing.sm }}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setLabel(s);
                      setErrors((e) => ({ ...e, label: undefined }));
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: label === s ? colors.brandTint : colors.chip,
                        borderRadius: radius.full,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 7,
                      },
                      pressed ? pressCard : null,
                    ]}
                  >
                    <Text style={{ color: label === s ? colors.brand : colors.muted, fontSize: 12.5, fontWeight: "700" }}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={useMyLocation}
                disabled={locating}
                style={({ pressed }) => [
                  {
                    ...ROW,
                    alignItems: "center",
                    gap: spacing.md,
                    backgroundColor: coords ? colors.brandTint : colors.card,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: coords ? colors.brand : colors.border,
                    padding: spacing.md,
                    opacity: locating ? 0.6 : 1,
                  },
                  pressed ? pressCard : null,
                ]}
              >
                <Ionicons name={coords ? "checkmark-circle" : "locate"} size={20} color={colors.brand} />
                <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" }]}>
                  {locating ? t("loading") : t("useMyLocation")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCityModal(true)}
                style={({ pressed }) => [
                  {
                    ...ROW,
                    justifyContent: "space-between",
                    backgroundColor: colors.card,
                    borderWidth: 1.5,
                    borderColor: errors.city ? colors.danger : colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                  },
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <View style={{ ...ROW, gap: spacing.sm, flex: 1 }}>
                  <Ionicons name="location-outline" size={17} color={colors.brand} />
                  <Text
                    numberOfLines={1}
                    style={[RTL_TEXT, { flex: 1, color: selectedCity ? colors.text : colors.faint, fontSize: 15 }]}
                  >
                    {selectedCity ? loc(selectedCity, "name") : t("chooseCity")}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={17} color={colors.faint} />
              </Pressable>
              {errors.city ? (
                <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12 }]}>{errors.city}</Text>
              ) : null}

              <Input
                label={`${t("addrStreet")} (${t("optional")})`}
                placeholder={t("addressPlaceholder")}
                value={street}
                onChangeText={setStreet}
              />

              {/* editing the existing default: it already is, so no toggle */}
              {editing?.is_default ? null : (
                <Pressable
                  onPress={() => setMakeDefault((v) => !v)}
                  style={{ ...ROW, alignItems: "center", gap: spacing.sm, paddingVertical: 4 }}
                >
                  <Ionicons
                    name={makeDefault ? "checkbox" : "square-outline"}
                    size={22}
                    color={makeDefault ? colors.brand : colors.faint}
                  />
                  <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 14 }]}>{t("addrSetDefault")}</Text>
                </Pressable>
              )}

              <Button title={t("save")} loading={saving} onPress={save} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* city picker — same reason: it opens a keyboard for the search field */}
      <Modal visible={cityModal} transparent animationType="slide" onRequestClose={() => setCityModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setCityModal(false)} />
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              maxHeight: "75%",
              padding: spacing.lg,
              paddingBottom: spacing.lg,
              gap: spacing.md,
            }}
          >
            <SheetHandle />
            <Text style={[RTL_TEXT, { color: colors.text, fontSize: 17, fontWeight: "800" }]}>{t("chooseCity")}</Text>
            <SearchBar value={citySearch} onChangeText={setCitySearch} placeholder={t("searchCity")} />
            <FlatList
              data={filteredCities}
              keyExtractor={(c) => String(c.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCityId(item.id);
                    setCityModal(false);
                    setCitySearch("");
                    setErrors((e) => ({ ...e, city: undefined }));
                  }}
                  style={{
                    ...ROW,
                    justifyContent: "space-between",
                    paddingVertical: 13,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.hairline,
                  }}
                >
                  <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15 }]}>{loc(item, "name")}</Text>
                  {cityId === item.id ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
                </Pressable>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
