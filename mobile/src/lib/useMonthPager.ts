import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder, Platform } from "react-native";

const native = Platform.OS !== "web";

/**
 * Month paging for the calendar grid: a slide transition for the arrow buttons
 * and a horizontal swipe that follows the finger. With Reduce Motion on, the
 * month changes without sliding.
 *
 * `onChange(delta)` is called once the outgoing month has left the screen.
 * `onVertical(dir)` (optional) gets a clear vertical swipe: -1 = up, 1 = down.
 */
export function useMonthPager(onChange: (delta: number) => void, onVertical?: (dir: -1 | 1) => void) {
  const [slide] = useState(() => new Animated.Value(0));
  // Gesture state, read only inside event handlers and animation callbacks.
  const width = useRef(0);
  const busy = useRef(false);
  const reduceMotion = useRef(false);
  const onChangeRef = useRef(onChange);
  const onVerticalRef = useRef(onVertical);
  const axis = useRef<"x" | "y">("x");

  useEffect(() => {
    onChangeRef.current = onChange;
    onVerticalRef.current = onVertical;
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduceMotion.current = v;
      })
      .catch(() => null);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      reduceMotion.current = v;
    });
    return () => sub.remove();
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (delta === 0 || busy.current) return;
      const w = width.current || 400;
      if (reduceMotion.current) {
        slide.setValue(0);
        onChangeRef.current(delta);
        return;
      }
      busy.current = true;
      const dir = delta > 0 ? 1 : -1;
      // Outgoing month leaves toward the opposite side, incoming one enters from `dir`.
      Animated.timing(slide, { toValue: -dir * w, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: native }).start(() => {
        onChangeRef.current(delta);
        slide.setValue(dir * w);
        Animated.timing(slide, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start(() => {
          busy.current = false;
        });
      });
    },
    [slide],
  );

  // The handlers below only touch refs when a gesture event fires, never during render;
  // the lint rule cannot see that through PanResponder.create.
  /* eslint-disable react-hooks/refs */
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Only claim clear drags so taps still reach the day cells:
        // horizontal = month paging, vertical = the caller's onVertical (if any).
        onMoveShouldSetPanResponderCapture: (_, g) => {
          if (busy.current) return false;
          if (Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5) {
            axis.current = "x";
            return true;
          }
          if (onVerticalRef.current && Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5) {
            axis.current = "y";
            return true;
          }
          return false;
        },
        onPanResponderMove: (_, g) => {
          if (axis.current === "x" && !reduceMotion.current) slide.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (axis.current === "y") {
            if (g.dy < -24 || g.vy < -0.3) onVerticalRef.current?.(-1);
            else if (g.dy > 24 || g.vy > 0.3) onVerticalRef.current?.(1);
            return;
          }
          const w = width.current || 400;
          if (Math.abs(g.dx) > w * 0.2 || Math.abs(g.vx) > 0.5) {
            go(g.dx < 0 ? 1 : -1);
          } else {
            Animated.spring(slide, { toValue: 0, useNativeDriver: native, bounciness: 0 }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (axis.current === "y") return;
          Animated.spring(slide, { toValue: 0, useNativeDriver: native, bounciness: 0 }).start();
        },
      }),
    [go, slide],
  );
  /* eslint-enable react-hooks/refs */

  const setWidth = useCallback((w: number) => {
    width.current = w;
  }, []);

  return { slide, panHandlers: pan.panHandlers, go, setWidth };
}
