import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, View, type StyleProp, type TextStyle } from "react-native";
import { prefersReducedMotion } from "@/lib/motion";
import { T } from "./ui";

/** Scroll speed for text that doesn't fit (px per second) — slow enough to read along. */
const SPEED = 28;
const HOLD = 1400;

/**
 * One line of text. If it fits, it just sits there; if it's wider than its box, it waits, slides
 * slowly left until its end is visible, waits, fades back to the start and repeats. With the OS
 * "reduce motion" setting it stays still and is cut with "…".
 */
export function MarqueeText({
  children,
  variant,
  color,
  style,
}: {
  children: ReactNode;
  variant?: "headline" | "body" | "subhead" | "footnote" | "caption";
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const [op] = useState(() => new Animated.Value(1));
  const reduce = prefersReducedMotion();
  const over = boxW > 0 && textW > boxW + 1 ? textW - boxW : 0;

  useEffect(() => {
    x.setValue(0);
    op.setValue(1);
    if (!over || reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(HOLD),
        Animated.timing(x, { toValue: -over, duration: Math.max(1200, (over / SPEED) * 1000), easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(HOLD),
        Animated.timing(op, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [over, reduce, x, op]);

  if (reduce) {
    return (
      <T variant={variant} color={color} numberOfLines={1} style={style}>
        {children}
      </T>
    );
  }
  return (
    <View onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} style={{ alignSelf: "stretch", overflow: "hidden" }}>
      {/* A very wide row lets the text take its natural one-line width so it can be measured. */}
      <Animated.View style={{ flexDirection: "row", width: 4000, opacity: op, transform: [{ translateX: x }] }}>
        <T variant={variant} color={color} numberOfLines={1} onLayout={(e) => setTextW(e.nativeEvent.layout.width)} style={style}>
          {children}
        </T>
      </Animated.View>
    </View>
  );
}
