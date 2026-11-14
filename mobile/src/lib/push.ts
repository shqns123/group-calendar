import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { api, DEMO } from "./api";

/**
 * Phone push (Android, Firebase). The server sends data messages with `title` + `message`;
 * expo-notifications shows those itself while the app is closed or in the background, and the
 * handler below shows them as a banner while it's open.
 *
 * expo-notifications throws on import when the installed app was built without it (an older dev
 * client), so it's only loaded once its native side is known to be there.
 */
type NotificationsModule = typeof import("expo-notifications");

const Notifications: NotificationsModule | null =
  Platform.OS === "android" && !DEMO && requireOptionalNativeModule("ExpoPushTokenManager")
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("expo-notifications") as NotificationsModule)
    : null;

const CHANNEL = "default";

Notifications?.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let registered: string | null = null;

/** This phone's FCM token, asking for the notification permission (Android 13+) if needed. */
export async function devicePushToken(): Promise<string | null> {
  const N = Notifications;
  if (!N) return null;
  try {
    await N.setNotificationChannelAsync(CHANNEL, {
      name: "일정 알림",
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: "#2E63F6",
    });
    let { status } = await N.getPermissionsAsync();
    if (status !== "granted") ({ status } = await N.requestPermissionsAsync());
    if (status !== "granted") return null;
    const { data } = await N.getDevicePushTokenAsync();
    return typeof data === "string" && data ? data : null;
  } catch {
    // e.g. a build without google-services.json (test/development variants)
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
  if (!Notifications) return () => {};
  const sub = Notifications.addPushTokenListener(({ data }) => {
    if (registered && typeof data === "string" && data && data !== registered) void save(data).catch(() => null);
  });
  return () => sub.remove();
}
