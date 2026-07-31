// Tracks whether the user has seen the welcome/onboarding screen.
// The welcome screen is shown only once — on first launch after install.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "dalconnect.onboarded";

export async function hasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {}
}
