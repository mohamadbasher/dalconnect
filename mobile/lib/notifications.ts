import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Register for Expo push + store the token. Fire-and-forget on login. */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ?? undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await supabase.from("push_tokens").upsert(
      { token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: "token" }
    );
  } catch {
    // push is best-effort; never block the app on it
  }
}
