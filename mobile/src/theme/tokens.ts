// Design tokens — mirrors DESIGN.md at the repo root ("조용한 업무 캘린더").
// Every color has a light and a dark value (The Night Room Rule).
// Key names are semantic roles used across screens; values follow DESIGN.md.

import { Platform, type TextStyle } from "react-native";

export type ColorTokens = {
  bg: string; // canvas
  surface: string; // white sections, headers
  sheet: string; // bottom-sheet background (canvas)
  card: string; // section surface
  outline: string; // divider — inside lists only
  subtle: string; // surface-muted: inputs, chips, secondary buttons
  strong: string; // non-text control outlines (≥3:1)
  handle: string;
  text: string;
  text2: string; // text-secondary (AA on every surface)
  muted: string; // small but required text — same as text-secondary for AA
  tertiary: string; // disabled only
  primary: string; // action
  onPrimary: string;
  primaryText: string;
  primaryContainer: string; // action-tint
  onPrimaryContainer: string;
  sunday: string;
  saturday: string;
  danger: string;
  onDanger: string;
  dangerContainer: string;
  warnContainer: string;
  warnBorder: string;
  onWarn: string;
  okContainer: string;
  onOk: string;
  infoContainer: string;
  infoBorder: string;
  onInfo: string;
  attendanceContainer: string;
  onAttendance: string;
  overtime: string;
  onOvertime: string;
  overtimeTrack: string;
  overtimeContainer: string;
  onOvertimeContainer: string;
  holidayContainer: string;
  onHoliday: string;
  offText: string;
  switchOff: string;
  fill: string;
  segmentTrack: string;
  segmentSelected: string;
  scrim: string;
  shadow: string;
  eventWashAlpha: string;
};

export const light: ColorTokens = {
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  sheet: "#F5F6F8",
  card: "#FFFFFF",
  outline: "#E8EBEF",
  subtle: "#F0F2F5",
  strong: "#8B95A1",
  handle: "#B0B8C1",
  text: "#191F28",
  text2: "#5F6B79",
  muted: "#5F6B79",
  tertiary: "#8B95A1",
  primary: "#4F46E5",
  onPrimary: "#FFFFFF",
  primaryText: "#4F46E5",
  primaryContainer: "#F0EFFF",
  onPrimaryContainer: "#4F46E5",
  sunday: "#DC2626",
  saturday: "#2563EB",
  danger: "#C92A2A",
  onDanger: "#FFFFFF",
  dangerContainer: "#FDECEC",
  warnContainer: "#FFF8E6",
  warnBorder: "#FFF8E6",
  onWarn: "#8A4B08",
  okContainer: "#EAF8F1",
  onOk: "#0B6B48",
  infoContainer: "#E8F7FA",
  infoBorder: "#0E6475",
  onInfo: "#0E6475",
  attendanceContainer: "#EAF1FF",
  onAttendance: "#1D4ED8",
  overtime: "#F59E0B",
  onOvertime: "#191F28",
  overtimeTrack: "#D97706",
  overtimeContainer: "#FFF4DE",
  onOvertimeContainer: "#B45309",
  holidayContainer: "#FDECEC",
  onHoliday: "#C92A2A",
  offText: "#C92A2A",
  switchOff: "#8B95A1",
  fill: "#E8EBEF",
  segmentTrack: "#F0F2F5",
  segmentSelected: "#FFFFFF",
  scrim: "rgba(25,31,40,0.42)",
  shadow: "#191F28",
  eventWashAlpha: "24",
};

export const dark: ColorTokens = {
  bg: "#101318",
  surface: "#1B2028",
  sheet: "#101318",
  card: "#1B2028",
  outline: "#343C48",
  subtle: "#252B35",
  strong: "#98A3B1",
  handle: "#5C6675",
  text: "#F4F6F8",
  text2: "#B2BBC7",
  muted: "#B2BBC7",
  tertiary: "#98A3B1",
  primary: "#A5A0FF",
  onPrimary: "#101318",
  primaryText: "#A5A0FF",
  primaryContainer: "#302D4D",
  onPrimaryContainer: "#D9D6FF",
  sunday: "#F87171",
  saturday: "#60A5FA",
  danger: "#FF8585",
  onDanger: "#101318",
  dangerContainer: "#3A1F22",
  warnContainer: "#2E2614",
  warnBorder: "#2E2614",
  onWarn: "#FCD34D",
  okContainer: "#15302A",
  onOk: "#6EE7B7",
  infoContainer: "#132D35",
  infoBorder: "#67E8F9",
  onInfo: "#67E8F9",
  attendanceContainer: "#1C2A44",
  onAttendance: "#93C5FD",
  overtime: "#F59E0B",
  onOvertime: "#101318",
  overtimeTrack: "#F59E0B",
  overtimeContainer: "#2E2614",
  onOvertimeContainer: "#FCD34D",
  holidayContainer: "#3A1F22",
  onHoliday: "#FF8585",
  offText: "#FF8585",
  switchOff: "#5C6675",
  fill: "#343C48",
  segmentTrack: "#252B35",
  segmentSelected: "#343C48",
  scrim: "rgba(0,0,0,0.6)",
  shadow: "#000000",
  eventWashAlpha: "40",
};

/** Event palette — identical to the web EventModal. */
export const EVENT_COLORS: { hex: string; name: string }[] = [
  { hex: "#3B82F6", name: "파랑" },
  { hex: "#6366F1", name: "인디고" },
  { hex: "#8B5CF6", name: "보라" },
  { hex: "#EC4899", name: "분홍" },
  { hex: "#EF4444", name: "빨강" },
  { hex: "#F97316", name: "주황" },
  { hex: "#F59E0B", name: "호박" },
  { hex: "#10B981", name: "초록" },
  { hex: "#14B8A6", name: "청록" },
  { hex: "#06B6D4", name: "하늘" },
];

/**
 * Type roles (DESIGN.md › Typography). System fonts; sizes scale with the OS text setting.
 * title1 = Display, title2 = Title, subhead = Support, footnote = Label.
 */
export const type = {
  title1: { fontSize: 30, fontWeight: "700", lineHeight: 36, letterSpacing: -0.5 },
  title2: { fontSize: 22, fontWeight: "700", lineHeight: 29, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: "600", lineHeight: 24 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 24 },
  subhead: { fontSize: 15, fontWeight: "400", lineHeight: 22 },
  footnote: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export const radius = { chip: 6, control: 14, card: 20, sheet: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Minimum touch target: 44pt on iOS, 48dp on Android. */
export const HIT = Platform.OS === "android" ? 48 : 44;

export function eventWash(hex: string, c: ColorTokens) {
  return `${hex}${c.eventWashAlpha}`;
}
