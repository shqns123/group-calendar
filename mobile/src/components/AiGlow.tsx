import { useEffect, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Colors along the line from its tail to its head (Google's "AI Mode" chip colors): blue →
 * purple → red → yellow → green. The ring turns clockwise, so green leads and blue trails; the
 * line fades out at both ends, leaving a soft gap.
 */
export const AI_COLORS = ["#4285F4", "#B45EDB", "#EA4335", "#FBBC04", "#34A853"] as const;

/** Room around the card for the ring (it sits just outside the card's edge). */
export const GLOW_MARGIN = 4;
/** Line thickness. */
const LINE = 2.5;
/** Share of the edge the colored line covers; the rest is the faded gap. */
const ARC = 0.8;
/** Fade at the trailing tail (longer) and at the leading head (shorter), as shares of the line. */
const FADE_IN = 0.24;
const FADE_OUT = 0.18;
/** The line is drawn as this many short pieces, each one color (SVG has no along-path gradient). */
const PIECES = 60;
/** One slow turn of the whole ring. */
const LAP_MS = 6000;

type Size = { w: number; h: number };

/** Rounded-rect outline starting at the top-left corner's end, clockwise; path + perimeter. */
function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const d = [
    `M ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    "Z",
  ].join(" ");
  const perimeter = 2 * (w - 2 * rr) + 2 * (h - 2 * rr) + 2 * Math.PI * rr;
  return { d, perimeter };
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** Color at `t` (0 → 1) along AI_COLORS. */
function colorAt(t: number) {
  const span = AI_COLORS.length - 1;
  const i = Math.min(span - 1, Math.floor(t * span));
  const f = t * span - i;
  const a = hex(AI_COLORS[i]);
  const b = hex(AI_COLORS[i + 1]);
  const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}
const smooth = (x: number) => x * x * (3 - 2 * x);
/** Opacity at `t` along the line: fades in at the start and out at the end. */
function alphaAt(t: number) {
  if (t < FADE_IN) return smooth(t / FADE_IN);
  if (t > 1 - FADE_OUT) return smooth((1 - t) / FADE_OUT);
  return 1;
}

/**
 * AI activation ring for the quick-add card (after Google's "AI Mode" chip): a thin line just
 * outside the card's edge whose color runs blue → purple → red → yellow → green along its length,
 * fading out at both ends. The whole ring turns slowly clockwise with the green end leading while
 * AI mode is on; under the OS "reduce motion" setting it holds still.
 *
 * `radius(h)` gives the card's corner radius for a card height (the card morphs pill ⇄ card).
 */
export function AiAura({ on, radius }: { on: boolean; radius: (cardH: number) => number }) {
  const [size, setSize] = useState<Size | null>(null);
  const [now, setNow] = useState(0);
  const still = prefersReducedMotion();

  useEffect(() => {
    if (!on || still) return;
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      setNow(Date.now() - start);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on, still]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((cur) => (cur && Math.abs(cur.w - width) < 0.5 && Math.abs(cur.h - height) < 0.5 ? cur : { w: width, h: height }));
  };

  let body = null;
  if (size && size.w > 2 * GLOW_MARGIN && size.h > 2 * GLOW_MARGIN) {
    const M = GLOW_MARGIN;
    const cw = size.w - 2 * M;
    const ch = size.h - 2 * M;
    // Centered half a line outside the card edge, so the whole line shows beside the card.
    const o = LINE / 2;
    const r = radius(ch) + o;
    const { d, perimeter } = roundedRect(M - o, M - o, cw + LINE, ch + LINE, r);
    // Where the line's tail starts: the top-middle at rest. The ring turns clockwise; the green
    // head leads and the blue/purple tail follows.
    const topMiddle = (cw + LINE) / 2 - r;
    const startAt = topMiddle + perimeter * ((now % LAP_MS) / LAP_MS);
    const piece = (ARC * perimeter) / PIECES;
    body = (
      <Svg width={size.w} height={size.h}>
        {Array.from({ length: PIECES }, (_, i) => {
          const t = (i + 0.5) / PIECES;
          const from = (((startAt + i * piece) % perimeter) + perimeter) % perimeter;
          const alpha = alphaAt(t);
          // Solid pieces overlap a hair so they meet without a seam; see-through ones must not,
          // or the overlap shows as a darker tick.
          const len = piece + (alpha > 0.99 ? 0.6 : 0);
          return (
            <Path
              key={i}
              d={d}
              fill="none"
              stroke={colorAt(t)}
              strokeOpacity={alpha}
              strokeWidth={LINE}
              strokeDasharray={`${len} ${Math.max(1, perimeter - len)}`}
              strokeDashoffset={-from}
            />
          );
        })}
      </Svg>
    );
  }

  return (
    <View pointerEvents="none" onLayout={onLayout} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {body}
    </View>
  );
}
