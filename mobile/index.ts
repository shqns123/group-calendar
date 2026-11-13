// App entry: Expo Router as before, plus the Android home-screen widget task.
import "expo-router/entry";
import { Platform } from "react-native";

if (Platform.OS === "android") {
  try {
    // Required lazily so a build without the widget native module (an older dev client) still starts.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { registerWidgetTaskHandler } = require("react-native-android-widget") as typeof import("react-native-android-widget");
    const { widgetTaskHandler } = require("./src/widget/task") as typeof import("./src/widget/task");
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // No widget support in this build.
  }
}
