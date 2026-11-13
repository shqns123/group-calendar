import { useRef, useState, type ComponentRef } from "react";
import { Modal, Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { EVENT_COLORS } from "@/theme/tokens";

/**
 * Color dot beside the title (Samsung Calendar style): tap it and a small floating palette
 * opens right under it; pick a color or tap outside to close.
 */
export function ColorDot({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const { c, isDark } = useTheme();
  const anchor = useRef<ComponentRef<typeof Pressable>>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const name = EVENT_COLORS.find((x) => x.hex === value)?.name ?? "색상";

  const open = () =>
    anchor.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      // Align the palette's right edge with the screen gutter, just below the dot.
      setPos({ top: y + h + 6, right: 16 });
    });

  return (
    <>
      <Pressable
        ref={anchor}
        accessibilityRole="button"
        accessibilityLabel={`색상, ${name}`}
        accessibilityHint="눌러서 색상 선택"
        hitSlop={10}
        onPress={open}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: value }} />
      </Pressable>

      <Modal visible={pos != null} transparent animationType="fade" onRequestClose={() => setPos(null)} statusBarTranslucent>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={() => setPos(null)} style={{ flex: 1 }}>
          {pos ? (
            <Pressable
              // Swallow taps on the card itself so they don't close it.
              onPress={() => {}}
              accessibilityRole="radiogroup"
              accessibilityLabel="색상"
              style={{
                position: "absolute",
                top: pos.top,
                right: pos.right,
                width: 5 * 52 + 24,
                flexDirection: "row",
                flexWrap: "wrap",
                padding: 12,
                borderRadius: 24,
                backgroundColor: c.card,
                shadowColor: "#0F172A",
                shadowOpacity: isDark ? 0.5 : 0.18,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
                elevation: 10,
              }}
            >
              {EVENT_COLORS.map((col) => {
                const on = col.hex === value;
                return (
                  <Pressable
                    key={col.hex}
                    accessibilityRole="radio"
                    accessibilityLabel={col.name}
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      onChange(col.hex);
                      setPos(null);
                    }}
                    style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
                  >
                    {/* Selected: a ring in the same color around the swatch. */}
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: on ? 2 : 0, borderColor: col.hex }}>
                      <View style={{ width: on ? 30 : 34, height: on ? 30 : 34, borderRadius: 17, backgroundColor: col.hex }} />
                    </View>
                  </Pressable>
                );
              })}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
