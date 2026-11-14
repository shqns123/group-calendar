import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform } from "react-native";
import { EASE_OUT, prefersReducedMotion } from "./motion";

const native = Platform.OS !== "web";
/** Pages either side of `base` the strip has room for before it re-centers (re-centering happens at rest). */
export const STRIP_SPAN = 24;
/** Release faster than this (px/ms) decides by direction alone; slower releases go by distance. */
const FLICK = 0.5;
/** Past this share of the width, a slow release still turns the page. */
const DISTANCE = 0.2;

/**
 * Month paging as one continuous strip (One UI): the previous, current and next months sit side
 * by side, the drag moves them together, and on release the strip carries the finger's own speed
 * into a soft, no-overshoot stop, either on the next month or back where it was.
 *
 * `index` = the shown month (year * 12 + month - 1). `onChange(delta)` fires once the strip has
 * landed: rendering the new month's neighbors while it is still moving used to stall the slide
 * for a moment on release. The next month is already on screen beside the current one, so nothing
 * waits for it. `heading` is the month the strip is heading to, set the moment the finger lifts,
 * so the title can flip with the slide; only that text re-renders then.
 * `onVertical(dir)` (optional) gets a clear vertical swipe: -1 = up, 1 = down.
 */
export function useMonthPager(index: number, onChange: (delta: number) => void, onVertical?: (dir: -1 | 1) => void) {
  const [slide] = useState(() => new Animated.Value(0));
  const [width, setWidthState] = useState(0);
  // Strip origin: page `m` sits at (m - base + STRIP_SPAN) * width.
  const [base, setBase] = useState(index);
  // Gesture / animation state, read only in handlers and callbacks.
  const target = useRef(index); // where the strip is heading
  const committed = useRef(index); // what the caller has been told
  const w = useRef(0);
  const baseRef = useRef(index);
  const axis = useRef<"x" | "y">("x");
  const grabDx = useRef(0);
  const handlers = useRef({ onChange, onVertical });
  // Title month during a glide: { from: month the caller still shows, to: where the strip is going }.
  const [ahead, setAhead] = useState<{ from: number; to: number } | null>(null);
  const heading = ahead && ahead.from === index ? ahead.to : index;
  useLayoutEffect(() => {
    handlers.current = { onChange, onVertical };
  });

  // Size or origin changed (at rest): put the strip where the current month is.
  useLayoutEffect(() => {
    w.current = width;
    baseRef.current = base;
    slide.stopAnimation();
    slide.setValue(-(target.current - base) * width);
  }, [width, base, slide]);

  // Month changed from outside (not by this pager): jump there.
  useLayoutEffect(() => {
    if (index === committed.current) return;
    committed.current = index;
    target.current = index;
    slide.stopAnimation();
    slide.setValue(-(index - baseRef.current) * w.current);
  }, [index, slide]);

  /** Strip at rest: tell the caller where it landed, and re-center when far from the origin. */
  const landed = useCallback(() => {
    const d = target.current - committed.current;
    if (d) {
      committed.current = target.current;
      handlers.current.onChange(d);
    }
    if (Math.abs(target.current - baseRef.current) > STRIP_SPAN - 2) setBase(target.current);
  }, []);

  /** Release: a spring that starts at the finger's own speed and stops without overshoot. */
  const glideTo = useCallback(
    (i: number, vx: number) => {
      const to = -(i - baseRef.current) * w.current;
      if (prefersReducedMotion() || !w.current) {
        slide.setValue(to);
        landed();
        return;
      }
      // vx is px/ms; the spring wants px/s. Keep the finger's speed only when it points toward the
      // destination, so the strip never lurches the wrong way first.
      const at = (slide as unknown as { _value: number; _offset: number })._value;
      const toward = Math.sign(to - at);
      const v = Math.sign(vx) === toward ? Math.min(Math.abs(vx) * 1000, 9000) * toward : 0;
      Animated.spring(slide, {
        toValue: to,
        velocity: v,
        stiffness: 260,
        damping: 32,
        mass: 1,
        overshootClamping: true,
        restDisplacementThreshold: 0.5,
        restSpeedThreshold: 0.5,
        useNativeDriver: native,
      }).start(({ finished }) => {
        if (finished) landed();
      });
    },
    [slide, landed],
  );

  /** Arrow buttons: decelerating slide to the next / previous month. */
  const go = useCallback(
    (delta: number) => {
      if (delta === 0) return;
      target.current += delta;
      setAhead({ from: committed.current, to: target.current });
      const to = -(target.current - baseRef.current) * w.current;
      if (prefersReducedMotion() || !w.current) {
        slide.setValue(to);
        landed();
        return;
      }
      Animated.timing(slide, { toValue: to, duration: 420, easing: EASE_OUT, useNativeDriver: native }).start(({ finished }) => {
        if (finished) landed();
      });
    },
    [slide, landed],
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
        onPanResponderGrant: (_, g) => {
          if (axis.current !== "x") return;
          // Catch the strip wherever it is (even mid-glide) and drag from there, without the hop
          // of the distance the finger already moved before the drag was recognised.
          slide.stopAnimation();
          slide.extractOffset();
          grabDx.current = g.dx;
        },
        onPanResponderMove: (_, g) => {
          if (axis.current === "x" && !prefersReducedMotion()) slide.setValue(g.dx - grabDx.current);
        },
        onPanResponderRelease: (_, g) => {
          if (axis.current === "y") {
            if (g.dy < -24 || g.vy < -0.3) handlers.current.onVertical?.(-1);
            else if (g.dy > 24 || g.vy > 0.3) handlers.current.onVertical?.(1);
            return;
          }
          slide.flattenOffset();
          const width = w.current || 400;
          // A flick decides by its direction (a flick back cancels); a slow release by distance.
          let delta = 0;
          if (g.vx < -FLICK) delta = 1;
          else if (g.vx > FLICK) delta = -1;
          else if (g.dx < -width * DISTANCE) delta = 1;
          else if (g.dx > width * DISTANCE) delta = -1;
          // Turn at most one month from where this drag started.
          const from = Math.round(target.current);
          target.current = from + delta;
          setAhead({ from: committed.current, to: target.current });
          glideTo(target.current, g.vx);
        },
        onPanResponderTerminate: (_, g) => {
          if (axis.current === "y") return;
          slide.flattenOffset();
          glideTo(target.current, g.vx);
        },
      }),
    [slide, glideTo],
  );
  /* eslint-enable react-hooks/refs */

  const setWidth = useCallback((next: number) => {
    setWidthState((cur) => (Math.abs(cur - next) < 0.5 ? cur : next));
  }, []);

  return { slide, panHandlers: pan.panHandlers, go, setWidth, width, base, heading };
}
