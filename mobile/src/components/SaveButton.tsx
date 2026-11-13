import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, View } from "react-native";
import { SPRING, springTo } from "@/lib/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { T } from "./ui";

export type SavePhase = "idle" | "saving" | "done";

const H = 40;

/**
 * One element that morphs: the "저장" pill shrinks into a round spinner while saving,
 * then turns into a check when it's done. The label/spinner/check swap with a short fade.
 */
export function SaveButton({ phase, onPress, label = "저장" }: { phase: SavePhase; onPress: () => void; label?: string }) {
  const { c } = useTheme();
  const [labelW, setLabelW] = useState(0);
  const pillW = Math.max(68, labelW + 40);
  const [w] = useState(() => new Animated.Value(68));
  const [fadeLabel] = useState(() => new Animated.Value(1));
  const [fadeIcon] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const idle = phase === "idle";
    springTo(w, idle ? pillW : H, SPRING);
    springTo(fadeLabel, idle ? 1 : 0, SPRING);
    springTo(fadeIcon, idle ? 0 : 1, SPRING);
  }, [phase, pillW, w, fadeLabel, fadeIcon]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={phase === "saving" ? "저장 중" : phase === "done" ? "저장됨" : label}
      accessibilityState={{ busy: phase === "saving", disabled: phase !== "idle" }}
      disabled={phase !== "idle"}
      onPress={onPress}
      hitSlop={6}
    >
      {({ pressed }) => (
        <Animated.View
          style={{
            width: w,
            height: H,
            borderRadius: H / 2,
            backgroundColor: c.primary,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <Animated.View style={{ position: "absolute", opacity: fadeLabel }} onLayout={(e) => setLabelW(e.nativeEvent.layout.width)}>
            <T variant="subhead" style={{ fontWeight: "600" }} color={c.onPrimary} numberOfLines={1}>
              {label}
            </T>
          </Animated.View>
          <Animated.View style={{ position: "absolute", opacity: fadeIcon }}>
            {phase === "done" ? <Icon name="check" size={20} color={c.onPrimary} /> : phase === "saving" ? <ActivityIndicator size="small" color={c.onPrimary} /> : <View />}
          </Animated.View>
        </Animated.View>
      )}
    </Pressable>
  );
}
