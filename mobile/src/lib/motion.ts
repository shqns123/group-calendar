// Shared motion rules (from the motion brief): springs with at most a tiny overshoot,
// ~0.25–0.35s, and everything snaps instantly when the OS "reduce motion" setting is on.
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

/** Snappy spring, barely overshoots. */
export const SPRING = { stiffness: 420, damping: 34, mass: 1 } as const;
/** Faster spring for a leading edge (it runs ahead, the trailing edge catches up). */
export const SPRING_LEAD = { stiffness: 620, damping: 40, mass: 1 } as const;
/** Slower spring for a trailing edge. */
export const SPRING_TRAIL = { stiffness: 300, damping: 30, mass: 1 } as const;

let reduceMotion = false;
void AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion = v)).catch(() => {});
AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => (reduceMotion = v));

export function prefersReducedMotion() {
  return reduceMotion;
}

export function useReducedMotion() {
  const [v, setV] = useState(reduceMotion);
  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setV);
    return () => sub?.remove();
  }, []);
  return v;
}

/** Spring a value to `to` (or jump there under reduce motion). Layout props need useNativeDriver: false. */
export function springTo(
  value: Animated.Value,
  to: number,
  config: { stiffness: number; damping: number; mass: number } = SPRING,
  native = false,
  done?: () => void,
) {
  if (reduceMotion) {
    value.setValue(to);
    done?.();
    return;
  }
  Animated.spring(value, { toValue: to, ...config, useNativeDriver: native, restDisplacementThreshold: 0.2, restSpeedThreshold: 0.2 }).start(({ finished }) => {
    if (finished) done?.();
  });
}

// --- Timed transitions (Samsung One UI reference): decelerate in, leave faster than you came.
/** Fast start, long soft stop — entrances and things that settle. */
export const EASE_OUT = Easing.bezier(0.2, 0, 0, 1);
/** Gentle start, quick exit — things leaving the screen. */
export const EASE_IN = Easing.bezier(0.3, 0, 1, 1);
/** Durations (ms). Closing is always shorter than opening. */
export const DUR = { open: 220, close: 180, swap: 120, keyboard: 280 } as const;

/** Timed animation to `to` (or a jump under reduce motion). */
export function timeTo(value: Animated.Value, to: number, duration: number, easing: (t: number) => number = EASE_OUT, native = true, done?: () => void) {
  if (reduceMotion) {
    value.setValue(to);
    done?.();
    return;
  }
  Animated.timing(value, { toValue: to, duration, easing, useNativeDriver: native }).start(({ finished }) => {
    if (finished) done?.();
  });
}
