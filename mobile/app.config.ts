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

// Firebase (phone push). google-services.json is registered for kr.groupcalendar.app only, so the
// test/development variants (".test" / ".development" package) build without push.
const googleServicesFile = isProd ? "./google-services.json" : undefined;

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
      backgroundColor: "#2E63F6",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-secure-store",
    "@react-native-community/datetimepicker",
    // Push: status-bar glyph (white on transparent), brand tint, and the channel server pushes use.
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#2E63F6", defaultChannel: "default" }],
    // Android home-screen widgets: the 일정 요약 tab (today … 3 months ahead). Three entries in the
    // widget picker (4x1 / 4x2 / 4x3); all are resizable and switch layout by their real size.
    [
      "react-native-android-widget",
      {
        widgets: [
          { name: "ScheduleSmall", label: "일정 요약 (4x1)", description: "일정 요약 — 오늘·내일·이번 주 첫 일정", minWidth: "250dp", minHeight: "40dp", targetCellWidth: 4, targetCellHeight: 1, resizeMode: "horizontal|vertical", updatePeriodMillis: 1800000 },
          { name: "ScheduleMedium", label: "일정 요약 (4x2)", description: "일정 요약 — 구간별 일정", minWidth: "250dp", minHeight: "110dp", targetCellWidth: 4, targetCellHeight: 2, resizeMode: "horizontal|vertical", updatePeriodMillis: 1800000 },
          { name: "ScheduleLarge", label: "일정 요약 (4x3)", description: "일정 요약 전체 목록 (인원·기간 포함)", minWidth: "250dp", minHeight: "180dp", targetCellWidth: 4, targetCellHeight: 3, resizeMode: "horizontal|vertical", updatePeriodMillis: 1800000 },
        ],
      },
    ],
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
