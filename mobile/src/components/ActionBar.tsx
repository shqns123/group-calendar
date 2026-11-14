import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import type { SavePhase } from "./SaveButton";
import { T } from "./ui";

/** Height of the floating bar; forms pad their scroll content by this plus a margin. */
export const ACTION_BAR_H = 60;

/**
 * Floating 취소 | 저장 pill at the bottom of a form screen. It stays put while the form scrolls
 * under it. 저장 turns into a spinner while saving and a check once saved.
 */
export function ActionBar({ onCancel, onSave, phase }: { onCancel: () => void; onSave: () => void; phase: SavePhase }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const H = ACTION_BAR_H;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 16, alignItems: "center" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: H,
          width: 232,
          borderRadius: H / 2,
          backgroundColor: c.card,
          shadowColor: "#0F172A",
          shadowOpacity: isDark ? 0.5 : 0.14,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="취소"
          onPress={onCancel}
          style={({ pressed }) => ({ flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderTopLeftRadius: H / 2, borderBottomLeftRadius: H / 2, backgroundColor: pressed ? c.subtle : "transparent" })}
        >
          <T variant="headline" style={{ fontSize: 17, fontWeight: "700" }}>
            취소
          </T>
        </Pressable>
        <View style={{ width: 1, height: 22, backgroundColor: c.outline }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={phase === "saving" ? "저장 중" : phase === "done" ? "저장됨" : "저장"}
          accessibilityState={{ busy: phase === "saving", disabled: phase !== "idle" }}
          disabled={phase !== "idle"}
          onPress={onSave}
          style={({ pressed }) => ({ flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderTopRightRadius: H / 2, borderBottomRightRadius: H / 2, backgroundColor: pressed ? c.subtle : "transparent" })}
        >
          {phase === "saving" ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : phase === "done" ? (
            <Icon name="check" size={24} color={c.primary} />
          ) : (
            <T variant="headline" style={{ fontSize: 17, fontWeight: "700" }}>
              저장
            </T>
          )}
        </Pressable>
      </View>
    </View>
  );
}
