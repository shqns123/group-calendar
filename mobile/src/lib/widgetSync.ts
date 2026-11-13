// Keeps the Android home-screen widgets in step with the app: remembers which group the app is
// showing (the widget follows it) and redraws the widgets after data changes. No-op elsewhere.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

let timer: ReturnType<typeof setTimeout> | null = null;

/** Redraw all placed widgets (debounced — several saves in a row cause one refresh). */
export function refreshWidgets() {
  if (Platform.OS !== "android") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void (async () => {
      try {
        // Loaded lazily so web / iOS never touch the Android-only native module.
        const { requestWidgetUpdate } = await import("react-native-android-widget");
        const { loadWidgetData } = await import("@/widget/data");
        const { renderSchedule } = await import("@/widget/ScheduleWidget");
        const { WIDGET_NAMES } = await import("@/widget/task");
        const data = await loadWidgetData();
        for (const widgetName of WIDGET_NAMES) {
          await requestWidgetUpdate({ widgetName, renderWidget: (info) => renderSchedule(data, info.height) });
        }
      } catch {
        // Widgets are a nicety; never let them break the app.
      }
    })();
  }, 800);
}

/** The group the app is showing; the widget shows the same one. */
export async function setWidgetGroup(group: { id: string; name: string } | null) {
  if (Platform.OS !== "android") return;
  try {
    const { WIDGET_GROUP_KEY } = await import("@/widget/data");
    if (group) await SecureStore.setItemAsync(WIDGET_GROUP_KEY, JSON.stringify({ id: group.id, name: group.name }));
    else await SecureStore.deleteItemAsync(WIDGET_GROUP_KEY);
  } catch {
    return;
  }
  refreshWidgets();
}
