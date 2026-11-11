// Design tokens — mirrors DESIGN.md at the repo root ("네이비 관제실").
// Every color has a light and a dark value (The Night Room Rule).

import { Platform, type TextStyle } from "react-native";

export type ColorTokens = {
  bg: string;
  surface: string;
  sheet: string;
  card: string;
  outline: string;
  subtle: string;
  strong: string;
  handle: string;
  text: string;
  text2: string;
  muted: string;
  primary: string;
  onPrimary: string;
  primaryText: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  sunday: string;
  saturday: string;
  danger: string;
  onDanger: string;
  warnContainer: string;
  warnBorder: string;
  onWarn: string;
  okContainer: string;
  onOk: string;
  infoContainer: string;
  infoBorder: string;
  onInfo: string;
  overtime: string;
  onOvertime: string;
  overtimeTrack: string;
  offText: string;
  switchOff: string;
  fill: string;
  segmentTrack: string;
  segmentSelected: string;
  scrim: string;
  eventWashAlpha: string;
};

export const light: ColorTokens = {
  bg: "#F1F5F9",
  surface: "#FFFFFF",
  sheet: "#F8FAFC",
  card: "#FFFFFF",
  outline: "#E2E8F0",
  subtle: "#F1F5F9",
  strong: "#64748B",
  handle: "#94A3B8",
  text: "#0F172A",
  text2: "#475569",
  muted: "#64748B",
  primary: "#4F46E5",
  onPrimary: "#FFFFFF",
  primaryText: "#4F46E5",
  primaryContainer: "#EEF2FF",
  onPrimaryContainer: "#3730A3",
  sunday: "#DC2626",
  saturday: "#2563EB",
  danger: "#DC2626",
  onDanger: "#FFFFFF",
  warnContainer: "#FFFBEB",
  warnBorder: "#FDE68A",
  onWarn: "#92400E",
  okContainer: "#ECFDF5",
  onOk: "#065F46",
  infoContainer: "#ECFEFF",
  infoBorder: "#0E7490",
  onInfo: "#155E75",
  overtime: "#F59E0B",
  onOvertime: "#0F172A",
  overtimeTrack: "#D97706",
  offText: "#B91C1C",
  switchOff: "#8A8A8E",
  fill: "#E2E8F0",
  segmentTrack: "#E2E8F0",
  segmentSelected: "#FFFFFF",
  scrim: "rgba(15,23,42,0.45)",
  eventWashAlpha: "2E",
};

export const dark: ColorTokens = {
  bg: "#020617",
  surface: "#0F172A",
  sheet: "#0F172A",
  card: "#1E293B",
  outline: "#334155",
  subtle: "#1E293B",
  strong: "#94A3B8",
  handle: "#64748B",
  text: "#F1F5F9",
  text2: "#CBD5E1",
  muted: "#94A3B8",
  primary: "#818CF8",
  onPrimary: "#0F172A",
  primaryText: "#A5B4FC",
  primaryContainer: "#312E81",
  onPrimaryContainer: "#E0E7FF",
  sunday: "#F87171",
  saturday: "#60A5FA",
  danger: "#F87171",
  onDanger: "#0F172A",
  warnContainer: "#2A1C07",
  warnBorder: "#713F12",
  onWarn: "#FCD34D",
  okContainer: "#052E2B",
  onOk: "#6EE7B7",
  infoContainer: "#082F3A",
  infoBorder: "#67E8F9",
  onInfo: "#67E8F9",
  overtime: "#F59E0B",
  onOvertime: "#0F172A",
  overtimeTrack: "#F59E0B",
  offText: "#FCA5A5",
  switchOff: "#64748B",
  fill: "#334155",
  segmentTrack: "#1E293B",
  segmentSelected: "#475569",
  scrim: "rgba(0,0,0,0.6)",
  eventWashAlpha: "4D",
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

/** Type roles (DESIGN.md › Typography). System fonts; sizes scale with the OS text setting. */
export const type = {
  title1: { fontSize: 28, fontWeight: "700", lineHeight: 34, letterSpacing: -0.4 },
  title2: { fontSize: 22, fontWeight: "700", lineHeight: 28, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: "600", lineHeight: 23 },
  body: { fontSize: 17, fontWeight: "400", lineHeight: 24 },
  subhead: { fontSize: 15, fontWeight: "400", lineHeight: 21 },
  footnote: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: "600", lineHeight: 14 },
} satisfies Record<string, TextStyle>;

export const radius = { chip: 5, control: 12, card: 16, sheet: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Minimum touch target: 44pt on iOS, 48dp on Android. */
export const HIT = Platform.OS === "android" ? 48 : 44;

export function eventWash(hex: string, c: ColorTokens) {
  return `${hex}${c.eventWashAlpha}`;
}
