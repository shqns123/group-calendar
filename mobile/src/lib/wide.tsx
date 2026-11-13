// Unfolded / large screens (foldables, tablets): calendar on the left, the selected day's
// detail — or the 일정 요약 / 알림 / 설정 tab — on the right. Phones keep the one-pane layout.
// On a wide screen the user can switch to full screen (분할 ↔ 전체화면): then it behaves like
// the phone layout across the whole width.
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, useWindowDimensions } from "react-native";
import type { DateKey } from "./date";
import { DUR, EASE_OUT, prefersReducedMotion, timeTo } from "./motion";

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

// --- 분할 ↔ 전체화면 -------------------------------------------------------------------------

const FULL_KEY = "wide-full";
const SPLIT_KEY = "wide-split";
/** The calendar pane takes half … two thirds of the width when split. */
export const SPLIT_MIN = 1 / 2;
export const SPLIT_MAX = 2 / 3;
export function clampSplit(ratio: number) {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ratio));
}

type WideMode = {
  /** Full-screen layout is mounted (the phone layout across the whole width). */
  full: boolean;
  toggleFull: () => void;
  /** 0 = split, 1 = full: drives the calendar pane's width while switching. */
  progress: Animated.Value;
  /** Calendar pane's share of the width when split (dragged by the divider, remembered on the device). */
  split: number;
  setSplit: (ratio: number) => void;
};
const ModeCtx = createContext<WideMode>({ full: false, toggleFull: () => {}, progress: new Animated.Value(0), split: SPLIT_MIN, setSplit: () => {} });

/**
 * Holds the wide-screen mode (remembered on the device) and animates the switch:
 * split → full: the calendar pane grows from half to the whole width (the right pane slides and
 *   fades away), then the full-screen layout takes over — it looks the same at that moment.
 * full → split: the split layout mounts with the calendar still at full width, then it shrinks
 *   back to half while the right pane slides in.
 */
export function WideModeProvider({ children }: { children: ReactNode }) {
  const [full, setFull] = useState(false);
  const [split, setSplitState] = useState(SPLIT_MIN);
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (Platform.OS === "web") return;
    SecureStore.getItemAsync(SPLIT_KEY)
      .then((v) => {
        const n = Number(v);
        if (v && Number.isFinite(n)) setSplitState(clampSplit(n));
      })
      .catch(() => {});
  }, []);
  const setSplit = useCallback((ratio: number) => {
    setSplitState(ratio);
    if (Platform.OS !== "web") void SecureStore.setItemAsync(SPLIT_KEY, ratio.toFixed(4)).catch(() => {});
  }, []);
  const busy = useRef(false);
  const fullRef = useRef(false);
  useEffect(() => {
    fullRef.current = full;
  }, [full]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    SecureStore.getItemAsync(FULL_KEY)
      .then((v) => {
        const on = v === "1";
        progress.setValue(on ? 1 : 0);
        setFull(on);
      })
      .catch(() => {});
  }, [progress]);
  const toggleFull = useCallback(() => {
    if (busy.current) return;
    const next = !fullRef.current;
    if (Platform.OS !== "web") void SecureStore.setItemAsync(FULL_KEY, next ? "1" : "0").catch(() => {});
    if (prefersReducedMotion()) {
      progress.setValue(next ? 1 : 0);
      fullRef.current = next;
      setFull(next);
      return;
    }
    busy.current = true;
    // Finish exactly once: when the animation ends, or on a timer if it gets cut off — so the
    // switch can never get stuck half-way.
    let done = false;
    const finish = (end: () => void) => () => {
      if (done) return;
      done = true;
      busy.current = false;
      end();
    };
    if (next) {
      // Grow first (split layout still mounted), swap to the full layout once it fills the screen.
      const end = finish(() => {
        progress.setValue(1);
        fullRef.current = true;
        setFull(true);
      });
      timeTo(progress, 1, DUR.keyboard, EASE_OUT, false, end);
      setTimeout(end, DUR.keyboard + 150);
      return;
    }
    // Mount the split layout with the calendar still full width, then shrink it to half.
    fullRef.current = false;
    setFull(false);
    const end = finish(() => progress.setValue(0));
    requestAnimationFrame(() => timeTo(progress, 0, DUR.keyboard, EASE_OUT, false, end));
    setTimeout(end, DUR.keyboard + 150);
  }, [progress]);
  const value = useMemo(() => ({ full, toggleFull, progress, split, setSplit }), [full, toggleFull, progress, split, setSplit]);
  return <ModeCtx.Provider value={value}>{children}</ModeCtx.Provider>;
}

export function useWideMode() {
  return useContext(ModeCtx);
}

/** Two panes right now: a wide screen that isn't switched to full screen. */
export function useSplit() {
  const wide = useWide();
  const { full } = useWideMode();
  return wide && !full;
}

/**
 * Split: the width of the calendar pane on the left — screens and popups opened over the app
 * (day popup, edit forms, management screens, dialogs, sheets) sit to the right of it only.
 * 0 when not split (they cover the whole screen as on a phone).
 */
export function usePaneLeft() {
  const split = useSplit();
  const { split: ratio } = useWideMode();
  const { width } = useWindowDimensions();
  return split ? Math.round(clampSplit(ratio) * width) : 0;
}

// The month on screen, so switching 분할 ↔ 전체화면 (a different calendar view mounts) keeps it.
let shownMonth: { year: number; month: number } | null = null;
export function rememberMonth(m: { year: number; month: number }) {
  shownMonth = m;
}
export function rememberedMonth() {
  return shownMonth;
}
