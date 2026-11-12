import type { ExpoConfig } from "expo/config";

// Two app variants mirror the two NAS servers:
//   APP_VARIANT=test       → test server (docker-compose.test.yml)
//   APP_VARIANT=production → main server (docker-compose.yml)
// Server URLs come from EXPO_PUBLIC_API_URL (see .env.example).
const variant = process.env.APP_VARIANT ?? "development";
const isProd = variant === "production";
const suffix = isProd ? "" : `.${variant}`;
const nameSuffix = isProd ? "" : variant === "test" ? " (테스트)" : " (개발)";

const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

// A release build without a server address would silently run on demo data, and
// Android release builds refuse plain http. Fail the build instead.
if (isProd) {
  const api = process.env.EXPO_PUBLIC_API_URL ?? "";
  if (!/^https:\/\/[^/]+/.test(api) || process.env.EXPO_PUBLIC_DEMO === "1") {
    throw new Error("production 빌드에는 https 서버 주소(EXPO_PUBLIC_API_URL)가 필요하고 데모 모드는 꺼져 있어야 해요. eas.json의 production env를 확인하세요.");
  }
}

// EAS project id: `npx eas-cli init` prints it (it can't write into a .ts config itself).
// Paste it here once; it is not a secret.
const EAS_PROJECT_ID = "bbf2c3fd-960c-4f7a-9a83-867f87b32cf6";

const config: ExpoConfig = {
  name: `그룹 캘린더${nameSuffix}`,
  // Must match the EAS project (EAS_PROJECT_ID) slug.
  slug: "woojin",
  version: "1.0.0",
  scheme: "groupcalendar",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: `kr.groupcalendar.app${suffix}`,
    supportsTablet: false,
  },
  android: {
    package: `kr.groupcalendar.app${suffix}`,
    adaptiveIcon: {
      backgroundColor: "#0F172A",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-secure-store",
    "@react-native-community/datetimepicker",
    // Google Sign-In needs a development build (not Expo Go) and the iOS URL scheme
    // from Google Cloud Console. Without it, the app falls back to 이름+사번 login.
    ...(googleIosUrlScheme
      ? [["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }] as [string, object]]
      : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appVariant: variant,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
};

export default config;
