// Google Sign-In is a native module: it exists only in a development/production
// build, never in Expo Go or on web. Load it lazily so the app still runs there.
// On web the package does load, but only as a stub that throws "not-implemented
// method on web platform" (its web build is sponsor-only), so it's skipped there.
import { Platform } from "react-native";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

function load(): GoogleModule | null {
  if (!WEB_CLIENT_ID || Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as GoogleModule;
  } catch {
    return null;
  }
}

const mod = load();
let configured = false;

export const googleAvailable = mod != null;

/** Returns a Google ID token, or null when the user cancels. */
export async function getGoogleIdToken(): Promise<string | null> {
  if (!mod) throw new Error("Google 로그인은 앱 정식 빌드에서만 쓸 수 있어요.");
  const { GoogleSignin, isSuccessResponse } = mod;
  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, iosClientId: IOS_CLIENT_ID });
    configured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return null;
  if (!res.data.idToken) throw new Error("Google ID 토큰을 받지 못했어요.");
  return res.data.idToken;
}

export async function googleSignOut() {
  try {
    await mod?.GoogleSignin.signOut();
  } catch {
    // not signed in with Google
  }
}
