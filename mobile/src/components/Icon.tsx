import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";

// Semantic icon names → platform icon sets (DESIGN.md › Icons).
const MAP = {
  calendar: { ios: "calendar-outline", iosOn: "calendar", md: "calendar-today" },
  list: { ios: "list-outline", iosOn: "list", md: "view-list" },
  bell: { ios: "notifications-outline", iosOn: "notifications", md: "notifications" },
  settings: { ios: "settings-outline", iosOn: "settings", md: "settings" },
  add: { ios: "add", iosOn: "add", md: "add" },
  back: { ios: "chevron-back", iosOn: "chevron-back", md: "chevron-left" },
  forward: { ios: "chevron-forward", iosOn: "chevron-forward", md: "chevron-right" },
  down: { ios: "chevron-down", iosOn: "chevron-down", md: "expand-more" },
  search: { ios: "search-outline", iosOn: "search", md: "search" },
  edit: { ios: "create-outline", iosOn: "create", md: "edit" },
  note: { ios: "document-text-outline", iosOn: "document-text", md: "sticky-note-2" },
  check: { ios: "checkmark", iosOn: "checkmark", md: "check" },
  close: { ios: "close", iosOn: "close", md: "close" },
  pull: { ios: "arrow-down", iosOn: "arrow-down", md: "arrow-downward" },
  logout: { ios: "log-out-outline", iosOn: "log-out", md: "logout" },
  person: { ios: "person-circle-outline", iosOn: "person-circle", md: "account-circle" },
  trash: { ios: "trash-outline", iosOn: "trash", md: "delete-outline" },
  people: { ios: "people-outline", iosOn: "people", md: "group" },
  shield: { ios: "shield-checkmark-outline", iosOn: "shield-checkmark", md: "verified-user" },
  link: { ios: "link-outline", iosOn: "link", md: "link" },
  send: { ios: "paper-plane-outline", iosOn: "paper-plane", md: "send" },
  holiday: { ios: "sunny-outline", iosOn: "sunny", md: "beach-access" },
  sync: { ios: "cloud-upload-outline", iosOn: "cloud-upload", md: "cloud-upload" },
  join: { ios: "enter-outline", iosOn: "enter", md: "login" },
  info: { ios: "information-circle-outline", iosOn: "information-circle", md: "info-outline" },
  time: { ios: "time-outline", iosOn: "time", md: "schedule" },
  box: { ios: "cube-outline", iosOn: "cube", md: "inventory-2" },
} as const;

export type IconName = keyof typeof MAP;

export function Icon({ name, size = 24, color, filled }: { name: IconName; size?: number; color: string; filled?: boolean }) {
  const m = MAP[name];
  if (Platform.OS === "android") {
    return <MaterialIcons name={m.md as never} size={size} color={color} />;
  }
  return <Ionicons name={(filled ? m.iosOn : m.ios) as never} size={size} color={color} />;
}
