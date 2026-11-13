import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { SPRING, SPRING_LEAD, SPRING_TRAIL, springTo } from "@/lib/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { T } from "./ui";

export type OtValue = "yes" | "no" | "none";

/**
 * 불가능 / 가능 chips with one colored indicator that slides between them. Its two edges ride
 * different springs, so the leading edge stretches ahead and the trailing edge catches up.
 * Tapping the picked chip again clears it (the indicator shrinks away).
 */
export function OvertimeChips({ value, onPick, disabled }: { value: OtValue; onPick: (v: OtValue) => void; disabled?: boolean }) {
  const { c } = useTheme();
  const options = [
    { value: "no" as const, label: "불가능", bg: c.dangerContainer, fg: c.danger },
    { value: "yes" as const, label: "가능", bg: c.warnContainer, fg: c.onWarn },
  ];
  const [boxes, setBoxes] = useState<Partial<Record<"yes" | "no", { x: number; w: number }>>>({});
  const [left] = useState(() => new Animated.Value(0));
  const [right] = useState(() => new Animated.Value(0));
  const [shown] = useState(() => new Animated.Value(value === "none" ? 0 : 1));
  const prev = useRef<{ l: number; r: number } | null>(null);

  const target = value !== "none" ? boxes[value] : undefined;
  useEffect(() => {
    if (!target) {
      springTo(shown, 0, SPRING);
      prev.current = null;
      return;
    }
    const l = target.x;
    const r = target.x + target.w;
    if (!prev.current) {
      // First placement (or re-appearing): start in place, just fade/scale in.
      left.setValue(l);
      right.setValue(r);
    } else {
      const movingRight = l > prev.current.l;
      springTo(left, l, movingRight ? SPRING_TRAIL : SPRING_LEAD);
      springTo(right, r, movingRight ? SPRING_LEAD : SPRING_TRAIL);
    }
    springTo(shown, 1, SPRING);
    prev.current = { l, r };
  }, [target?.x, target?.w, left, right, shown, target]);

  // Keep the last color while the indicator fades out after a clear.
  const [lastVal, setLastVal] = useState<"yes" | "no">(value === "yes" ? "yes" : "no");
  if (value !== "none" && value !== lastVal) setLastVal(value);
  const active = options.find((o) => o.value === (value === "none" ? lastVal : value));

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="내 특근" style={{ flexDirection: "row", gap: 6 }}>
      {/* The sliding indicator sits behind the chip labels. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left,
          width: Animated.subtract(right, left),
          borderRadius: radius.pill,
          backgroundColor: active?.bg ?? "transparent",
          borderWidth: 1.5,
          borderColor: active?.fg ?? "transparent",
          opacity: shown,
          transform: [{ scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        }}
      />
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable
            key={o.value}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setBoxes((b) => (b[o.value]?.x === x && b[o.value]?.w === width ? b : { ...b, [o.value]: { x, w: width } }));
            }}
            accessibilityRole="radio"
            accessibilityLabel={`특근 ${o.label}`}
            accessibilityState={{ checked: on, disabled }}
            disabled={disabled}
            hitSlop={6}
            onPress={() => onPick(on ? "none" : o.value)}
            style={({ pressed }) => ({
              minHeight: 34,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: on ? "transparent" : c.outline,
              backgroundColor: !on && pressed ? c.fill : "transparent",
            })}
          >
            <T variant="footnote" color={on ? o.fg : c.text2} style={{ fontWeight: "700" }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
