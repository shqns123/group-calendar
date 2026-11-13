import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { api, DEMO } from "./api";

/**
 * Phone push (Android, Firebase). The server sends data messages with `title` + `message`;
 * expo-notifications shows those itself while the app is closed or in the background, and the
 * handler below shows them as a banner while it's open.
 */
const CHANNEL = "default";
const supported = Platform.OS === "android" && !DEMO;

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

let registered: string | null = null;

async function ensureChannel() {
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "일정 알림",
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lightColor: "#2E63F6",
  });
}

/** This phone's FCM token, asking for the notification permission (Android 13+) if needed. */
export async function devicePushToken(): Promise<string | null> {
  if (!supported) return null;
  try {
    await ensureChannel();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return null;
    const { data } = await Notifications.getDevicePushTokenAsync();
    return typeof data === "string" && data ? data : null;
  } catch {
    return null;
  }
}

async function save(token: string) {
  await api("/api/push/mobile-token", { method: "POST", body: { token } });
  registered = token;
}

/** Ties this phone to the signed-in account (also while the account waits for approval). */
export async function registerPush() {
  const token = await devicePushToken();
  if (!token || token === registered) return;
  await save(token).catch(() => null);
}

/** Before signing out: stop sending this account's pushes to this phone. */
export async function unregisterPush() {
  const token = registered;
  registered = null;
  if (!token) return;
  await api("/api/push/mobile-token", { method: "DELETE", body: { token } }).catch(() => null);
}

/** Firebase can rotate the token; keep the server's copy current while signed in. */
export function watchPushToken() {
  if (!supported) return () => {};
  const sub = Notifications.addPushTokenListener(({ data }) => {
    if (registered && typeof data === "string" && data && data !== registered) void save(data).catch(() => null);
  });
  return () => sub.remove();
}
