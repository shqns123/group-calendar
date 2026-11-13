import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform } from "react-native";
import { EASE_OUT, prefersReducedMotion } from "./motion";

const native = Platform.OS !== "web";
/** Pages either side of `base` the strip has room for before it re-centers (re-centering happens at rest). */
export const STRIP_SPAN = 24;

/**
 * Month paging as one continuous strip (One UI): the previous, current and next months sit side
 * by side, the drag moves them together, and a fling carries its speed into a soft, no-overshoot
 * stop. Pages are placed by absolute month index, so nothing has to jump when the month changes —
 * the caller just renders the new neighbor off screen.
 *
 * `index` = the shown month (year * 12 + month - 1). `onChange(delta)` fires as soon as the target
 * is known (finger released / arrow tapped) so the title flips right away; the slide itself runs
 * on the native driver and isn't held up by the re-render.
 * `onVertical(dir)` (optional) gets a clear vertical swipe: -1 = up, 1 = down.
 */
export function useMonthPager(index: number, onChange: (delta: number) => void, onVertical?: (dir: -1 | 1) => void) {
  const [slide] = useState(() => new Animated.Value(0));
  const [width, setWidthState] = useState(0);
  // Strip origin: page `m` sits at (m - base + STRIP_SPAN) * width.
  const [base, setBase] = useState(index);
  // Gesture / animation state, read only in handlers and callbacks.
  const target = useRef(index);
  const w = useRef(0);
  const baseRef = useRef(index);
  const axis = useRef<"x" | "y">("x");
  const handlers = useRef({ onChange, onVertical });
  useLayoutEffect(() => {
    handlers.current = { onChange, onVertical };
  });

  const rest = (i: number) => -(i - baseRef.current) * w.current;

  // Size or origin changed (at rest): put the strip where the current month is.
  useLayoutEffect(() => {
    w.current = width;
    baseRef.current = base;
    slide.stopAnimation();
    slide.setValue(-(target.current - base) * width);
  }, [width, base, slide]);

  // Month changed from outside (not by this pager): jump there.
  useLayoutEffect(() => {
    if (index === target.current) return;
    target.current = index;
    slide.stopAnimation();
    slide.setValue(-(index - baseRef.current) * w.current);
  }, [index, slide]);

  const settle = useCallback(() => {
    // Far from the origin: re-center while nothing moves.
    if (Math.abs(target.current - baseRef.current) > STRIP_SPAN - 2) setBase(target.current);
  }, []);

  /** Fling / drag release: spring that starts at the finger's speed and stops without overshoot. */
  const flingTo = useCallback(
    /** `dir`: which way the strip moves to get there (-1 = left, 1 = right, 0 = already there). */
    (i: number, vx: number, dir: number) => {
      const to = -(i - baseRef.current) * w.current;
      if (prefersReducedMotion()) {
        slide.setValue(to);
        settle();
        return;
      }
      // Gesture vx is px/ms; the spring wants px/s. Keep a minimum push so a slow release still
      // starts briskly (fast start, long soft stop).
      const speed = dir ? Math.min(Math.max(Math.abs(vx) * 1000, 1600), 9000) : 0;
      Animated.spring(slide, {
        toValue: to,
        velocity: dir * speed,
        stiffness: 240,
        damping: 31,
        mass: 1,
        overshootClamping: true,
        restDisplacementThreshold: 0.5,
        restSpeedThreshold: 0.5,
        useNativeDriver: native,
      }).start(({ finished }) => {
        if (finished) settle();
      });
    },
    [slide, settle],
  );

  /** Arrow buttons: decelerating slide to the next / previous month. */
  const go = useCallback(
    (delta: number) => {
      if (delta === 0) return;
      target.current += delta;
      handlers.current.onChange(delta);
      const to = rest(target.current);
      if (prefersReducedMotion() || !w.current) {
        slide.setValue(to);
        settle();
        return;
      }
      Animated.timing(slide, { toValue: to, duration: 420, easing: EASE_OUT, useNativeDriver: native }).start(({ finished }) => {
        if (finished) settle();
      });
    },
    [slide, settle],
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
          if (Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5) {
            axis.current = "x";
            return true;
          }
          if (handlers.current.onVertical && Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5) {
            axis.current = "y";
            return true;
          }
          return false;
        },
        onPanResponderGrant: () => {
          if (axis.current !== "x") return;
          // Catch the strip wherever it is (even mid-fling) and drag from there.
          slide.stopAnimation();
          slide.extractOffset();
        },
        onPanResponderMove: (_, g) => {
          if (axis.current === "x" && !prefersReducedMotion()) slide.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (axis.current === "y") {
            if (g.dy < -24 || g.vy < -0.3) handlers.current.onVertical?.(-1);
            else if (g.dy > 24 || g.vy > 0.3) handlers.current.onVertical?.(1);
            return;
          }
          slide.flattenOffset();
          const width = w.current || 400;
          let delta = 0;
          if (g.dx < -width * 0.2 || g.vx < -0.5) delta = 1;
          else if (g.dx > width * 0.2 || g.vx > 0.5) delta = -1;
          if (delta) {
            target.current += delta;
            handlers.current.onChange(delta);
          }
          // Next month = strip moves left; snapping back = toward where the finger came from.
          flingTo(target.current, delta ? g.vx : 0, delta ? -delta : -Math.sign(g.dx));
        },
        onPanResponderTerminate: () => {
          if (axis.current === "y") return;
          slide.flattenOffset();
          flingTo(target.current, 0, 0);
        },
      }),
    [slide, flingTo],
  );
  /* eslint-enable react-hooks/refs */

  const setWidth = useCallback((next: number) => {
    setWidthState((cur) => (Math.abs(cur - next) < 0.5 ? cur : next));
  }, []);

  return { slide, panHandlers: pan.panHandlers, go, setWidth, width, base };
}
