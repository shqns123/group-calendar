import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { todayKey, type DateKey } from "./date";

/** Tab bar pill height and the band around it (see AppTabBar in (tabs)/_layout). */
export const TAB_BAR_H = 62;
export const TAB_BAR_TOP = 6;

/** Height of the whole tab bar band (pill + gaps + the phone's bottom inset). */
export function useTabBarBand() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_TOP + TAB_BAR_H + Math.max(insets.bottom, 10) + 4;
}

/**
 * Bottom padding for a scroll view on a tab the bar floats over (일정 요약 / 알림 / 설정), so its
 * last row can scroll clear of the bar.
 */
export function useTabBarSpace(extra = 16) {
  return useTabBarBand() + extra;
}

type Dock = {
  /** The quick-add bar is out (the tab bar's + button). */
  open: boolean;
  toggle: () => void;
  close: () => void;
  /** Day a line without a date goes on: the calendar's selected day, else today. */
  date: DateKey;
  setDate: (d: DateKey | null) => void;
};

const Ctx = createContext<Dock>({ open: false, toggle: () => {}, close: () => {}, date: todayKey(), setDate: () => {} });

export function QuickAddDockProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<DateKey | null>(null);
  const value = useMemo<Dock>(
    () => ({
      open,
      toggle: () => setOpen((o) => !o),
      close: () => setOpen(false),
      date: picked ?? todayKey(),
      setDate: setPicked,
    }),
    [open, picked],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuickAddDock() {
  return useContext(Ctx);
}
