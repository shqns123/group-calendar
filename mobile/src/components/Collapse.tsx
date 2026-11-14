import { useEffect, useState, type ReactNode } from "react";
import { Animated, View } from "react-native";
import { EASE_IN, EASE_OUT, prefersReducedMotion } from "@/lib/motion";

const OPEN_MS = 280;
const CLOSE_MS = 200;

/**
 * A panel that folds open and shut. Opening: the space grows (280ms, ease-out) and the contents
 * fade in just behind it. Closing: the contents fade first, then the space folds (200ms).
 *
 * Driven by Animated rather than LayoutAnimation, which does nothing on web and isn't reliable on
 * every Android setup. The contents stay laid out at full height so they can be measured; while
 * closed they're hidden from touch and screen readers.
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [h, setH] = useState(0);
  const [grow] = useState(() => new Animated.Value(open ? 1 : 0));
  const [fade] = useState(() => new Animated.Value(open ? 1 : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      grow.setValue(open ? 1 : 0);
      fade.setValue(open ? 1 : 0);
      return;
    }
    const anim = open
      ? Animated.parallel([
          Animated.timing(grow, { toValue: 1, duration: OPEN_MS, easing: EASE_OUT, useNativeDriver: false }),
          Animated.sequence([Animated.delay(80), Animated.timing(fade, { toValue: 1, duration: 200, easing: EASE_OUT, useNativeDriver: false })]),
        ])
      : Animated.parallel([
          Animated.timing(fade, { toValue: 0, duration: 120, easing: EASE_IN, useNativeDriver: false }),
          Animated.timing(grow, { toValue: 0, duration: CLOSE_MS, easing: EASE_OUT, useNativeDriver: false }),
        ]);
    anim.start();
    return () => anim.stop();
  }, [open, grow, fade]);

  return (
    <Animated.View
      style={{ height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, h] }), overflow: "hidden" }}
      pointerEvents={open ? "auto" : "none"}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!open}
    >
      <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, opacity: fade }}>
        <View onLayout={(e) => setH(e.nativeEvent.layout.height)}>{children}</View>
      </Animated.View>
    </Animated.View>
  );
}
