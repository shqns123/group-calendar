"use no memo";
// Android background task for the home-screen widgets: added / periodic update (30 min) /
// resized / ↻ tapped → load today…+2 days and draw the layout for the widget's current size.
import type { WidgetTaskHandler } from "react-native-android-widget";
import { loadWidgetData } from "./data";
import { renderSchedule } from "./ScheduleWidget";

/** Names in app.config.ts (one per default size; all share this layout). */
export const WIDGET_NAMES = ["ScheduleSmall", "ScheduleMedium", "ScheduleLarge"] as const;

export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, clickAction, renderWidget }) => {
  if (widgetAction === "WIDGET_DELETED") return;
  if (widgetAction === "WIDGET_CLICK" && clickAction !== "REFRESH") return;
  // Something on screen right away when it's first placed or refreshed by hand.
  if (widgetAction === "WIDGET_ADDED" || clickAction === "REFRESH") renderWidget(renderSchedule(null, widgetInfo.height));
  const data = await loadWidgetData();
  renderWidget(renderSchedule(data, widgetInfo.height));
};
