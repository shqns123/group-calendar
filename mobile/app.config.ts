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

const config: ExpoConfig = {
  name: `그룹 캘린더${nameSuffix}`,
  slug: "group-calendar",
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
  },
};

export default config;
