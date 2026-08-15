// Edit profile — photo, name, email. Phone is the login and stays read-only.
//
// City used to live here. It doesn't any more: an account has no single city,
// a REQUEST does, and saved addresses now carry that per place. Asking once at
// signup and then quietly using a stale answer was worse than not asking.
//
// A new photo is not shown to anyone until an admin has looked at it — see
// migration 20260714000015. `avatar_url` is admin-only at the database level,
// so this screen writes `pending_avatar_url` and nothing else.
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { uploadImage } from "../lib/upload";
import { ROW, RTL_TEXT, RTL_INPUT } from "../lib/rtl";
import { Avatar, Button, Input, Loading } from "../components/ui";
import { useToast } from "../components/Toast";

/** Deliberately permissive: something@something.tld. Anything stricter starts
 *  rejecting real addresses, and the address is only ever confirmed by mail. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function EditProfileScreen() {
  const { colors, shadows } = useTheme();
  const { t } = useI18n();
  const { session, profile, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceSheet, setSourceSheet] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setEmail(profile.email ?? "");
    }
  }, [profile?.id]);

  if (!profile || !session?.user) return <Loading />;

  /**
   * Has anything actually changed? The save button stays inert until it has,
   * so the screen never invites a write that would do nothing — and a tap that
   * appears to succeed while changing nothing is its own small confusion.
   */
  const dirty =
    fullName.trim() !== (profile.full_name ?? "").trim() ||
    email.trim() !== (profile.email ?? "").trim();

  const uploadFrom = async (uri: string) => {
    setUploading(true);
    try {
      const url = await uploadImage({
        bucket: "avatars",
        userId: session.user.id,
        localUri: uri,
        fileName: `${Date.now()}.jpg`,
      });
      // pending_avatar_url, never avatar_url: the guard in the database rejects
      // the latter from anyone but an admin, which is what makes review real.
      const { error } = await supabase
        .from("profiles")
        .update({ pending_avatar_url: url, avatar_status: "pending" })
        .eq("id", session.user.id);
      if (error) throw error;
      await refresh();
      toast.success(t("avatarSubmitted"));
    } catch {
      Alert.alert(t("error"), t("editUploadError"));
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    setSourceSheet(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("avatarCameraDenied"));
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.[0]) return;
    uploadFrom(res.assets[0].uri);
  };

  const chooseFromLibrary = async () => {
    setSourceSheet(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.[0]) return;
    uploadFrom(res.assets[0].uri);
  };

  const save = async () => {
    const name = fullName.trim();
    const mail = email.trim();
    let bad = false;
    if (!name) {
      setNameError(t("editFullNameRequired"));
      bad = true;
    }
    // Empty is fine — the address is optional. Wrong is not.
    if (mail && !EMAIL_RE.test(mail)) {
      setEmailError(t("editEmailInvalid"));
      bad = true;
    }
    if (bad) return;

    setNameError("");
    setEmailError("");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name, email: mail || null })
        .eq("id", session.user.id);
      if (error) throw error;
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch {
      Alert.alert(t("error"));
    } finally {
      setSaving(false);
    }
  };

  const status = profile.avatar_status ?? "none";

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
          {t("profileEditProfile")}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* photo */}
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <Pressable onPress={() => setSourceSheet(true)} disabled={uploading}>
              {/* While a submission is pending, show the submitted photo — it's
                  what the person just chose, and showing the old one would read
                  as "my upload didn't work". */}
              <Avatar
                uri={status === "pending" ? profile.pending_avatar_url : profile.avatar_url}
                name={profile.full_name}
                size={104}
              />
              {uploading ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 52,
                    backgroundColor: colors.overlay,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.brand,
                  borderWidth: 3,
                  borderColor: colors.bg,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadows.card,
                }}
              >
                <Ionicons name="camera" size={16} color={colors.onBrand} />
              </View>
            </Pressable>

            {status === "pending" ? (
              <View
                style={{
                  backgroundColor: colors.warnTint,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  gap: 3,
                }}
              >
                <View style={{ ...ROW, alignItems: "center", gap: 6 }}>
                  <Ionicons name="hourglass-outline" size={15} color={colors.warn} />
                  <Text style={[RTL_TEXT, { color: colors.warn, fontSize: 13, fontWeight: "800" }]}>
                    {t("avatarPendingTitle")}
                  </Text>
                </View>
                <Text style={[RTL_TEXT, { color: colors.warn, fontSize: 12, lineHeight: 17 }]}>
                  {t("avatarPendingBody")}
                </Text>
              </View>
            ) : null}

            {status === "rejected" ? (
              <View
                style={{
                  backgroundColor: colors.dangerTint,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  gap: 3,
                }}
              >
                <View style={{ ...ROW, alignItems: "center", gap: 6 }}>
                  <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
                  <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 13, fontWeight: "800" }]}>
                    {t("avatarRejectedTitle")}
                  </Text>
                </View>
                <Text style={[RTL_TEXT, { color: colors.danger, fontSize: 12, lineHeight: 17 }]}>
                  {t("avatarRejectedBody")}
                </Text>
              </View>
            ) : null}
          </View>

          {/* name */}
          <Input
            label={t("editFullName")}
            value={fullName}
            onChangeText={(v) => {
              setFullName(v);
              if (nameError) setNameError("");
            }}
            error={nameError}
            autoCapitalize="words"
          />

          {/* email — replaces city, which belongs to a request, not an account */}
          <View style={{ gap: 6 }}>
            <Input
              label={`${t("editEmail")} (${t("optional")})`}
              placeholder={t("editEmailPlaceholder")}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (emailError) setEmailError("");
              }}
              error={emailError}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={[RTL_INPUT, { writingDirection: "ltr", textAlign: "left" }]}
            />
            <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{t("editEmailHint")}</Text>
          </View>

          {/* phone (read-only) */}
          <View style={{ gap: 6 }}>
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 13, fontWeight: "600" }]}>{t("editPhone")}</Text>
            <View
              style={{
                backgroundColor: colors.chip,
                borderRadius: radius.md,
                paddingHorizontal: 14,
                paddingVertical: 13,
                ...ROW,
                gap: 8,
              }}
            >
              <Ionicons name="lock-closed-outline" size={15} color={colors.faint} />
              <Text style={{ flex: 1, fontSize: 15, color: colors.muted, textAlign: "right", writingDirection: "ltr" }}>
                {"‎" + profile.phone}
              </Text>
            </View>
            <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12 }]}>{t("editPhoneNote")}</Text>
          </View>

          <View style={{ gap: 6 }}>
            <Button title={t("save")} onPress={save} loading={saving} disabled={!dirty || saving} />
            {!dirty ? (
              <Text style={[RTL_TEXT, { color: colors.faint, fontSize: 12, textAlign: "center" }]}>
                {t("editNoChanges")}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* where should the photo come from? */}
      {sourceSheet ? (
        <Pressable
          onPress={() => setSourceSheet(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.overlay,
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              gap: spacing.sm,
            }}
          >
            <Text
              style={[RTL_TEXT, { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: spacing.xs }]}
            >
              {t("avatarChangePhoto")}
            </Text>

            {[
              { icon: "camera-outline" as const, label: t("avatarTakePhoto"), onPress: takePhoto },
              { icon: "images-outline" as const, label: t("avatarChooseLibrary"), onPress: chooseFromLibrary },
            ].map((o) => (
              <Pressable
                key={o.label}
                onPress={o.onPress}
                style={({ pressed }) => ({
                  ...ROW,
                  alignItems: "center",
                  gap: spacing.md,
                  backgroundColor: colors.card,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
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
                  <Ionicons name={o.icon} size={18} color={colors.brand} />
                </View>
                <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" }]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}

            <Pressable
              onPress={() => setSourceSheet(false)}
              style={({ pressed }) => ({ paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: colors.muted, fontSize: 14.5, fontWeight: "700" }}>{t("cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}
