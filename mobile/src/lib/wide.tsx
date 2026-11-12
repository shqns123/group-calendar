// Unfolded / large screens (foldables, tablets): calendar on the left, the selected day's
// detail — or the 일정 요약 / 알림 / 설정 tab — on the right. Phones keep the one-pane layout.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import type { DateKey } from "./date";

/** Width (dp) from which the screen is split into two panes. */
export const WIDE_MIN_WIDTH = 600;

export function useWide() {
  return useWindowDimensions().width >= WIDE_MIN_WIDTH;
}

type WideDay = { date: DateKey | null; setDate: (d: DateKey | null) => void };

const Ctx = createContext<WideDay>({ date: null, setDate: () => {} });

/** The day picked on the left calendar, shared with the right pane. */
export function WideDayProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState<DateKey | null>(null);
  const value = useMemo(() => ({ date, setDate }), [date]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWideDay() {
  return useContext(Ctx);
}
