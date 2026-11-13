// In-app confirm / notice popup (replaces the OS alert). Centered card over a dim wash: fades in
// while scaling 0.95 → 1 (220ms, decelerating) and leaves faster (180ms) — the same motion as the
// day popup. `confirm()` / `notice()` in lib/confirm.ts drive it from anywhere.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Animated, BackHandler, Modal, Pressable, View } from "react-native";
import { closeDialog, currentDialog, subscribeDialog, type DialogRequest } from "@/lib/confirm";
import { DUR, EASE_IN, EASE_OUT, timeTo } from "@/lib/motion";
import { usePaneLeft } from "@/lib/wide";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { T } from "./ui";

export function DialogHost() {
  const req = useSyncExternalStore(subscribeDialog, currentDialog, currentDialog);
  // Keep the last request on screen while it animates out.
  const [shown, setShown] = useState<DialogRequest | null>(null);
  if (req && req !== shown) setShown(req);
  const [v] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (req) timeTo(v, 1, DUR.open, EASE_OUT);
  }, [req, v]);

  function answer(ok: boolean) {
    const r = shown;
    if (!r || !req) return;
    timeTo(v, 0, DUR.close, EASE_IN);
    // Unmount after the exit animation — on a timer, not the animation callback, so an
    // interrupted animation can never leave an invisible popup blocking touches.
    setTimeout(() => setShown((s) => (s === r ? null : s)), DUR.close + 40);
    closeDialog(r, ok);
  }

  // Android back = cancel.
  useEffect(() => {
    if (!req) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      answer(false);
      return true;
    });
    return () => sub.remove();
  });

  if (!shown) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => answer(false)}>
      <Dialog r={shown} v={v} onAnswer={answer} />
    </Modal>
  );
}

function Dialog({ r, v, onAnswer }: { r: DialogRequest; v: Animated.Value; onAnswer: (ok: boolean) => void }) {
  const { c, isDark } = useTheme();
  const single = r.kind === "notice";
  // Split screen: the popup and its dim wash stay in the right pane; a tap on the calendar side
  // cancels like a tap on the wash.
  const left = usePaneLeft();
  return (
    <View style={{ flex: 1 }}>
      {left ? <Pressable accessible={false} onPress={() => onAnswer(false)} style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: left }} /> : null}
      <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, left, justifyContent: "center", paddingHorizontal: 28 }}>
      <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: v }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={single ? "닫기" : "취소"}
          onPress={() => onAnswer(false)}
          style={{ flex: 1, backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.32)" }}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityRole="alert"
        style={{
          opacity: v,
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
          backgroundColor: c.card,
          borderRadius: radius.sheet,
          paddingTop: 24,
          paddingHorizontal: 24,
          paddingBottom: 12,
          shadowColor: "#0F172A",
          shadowOpacity: isDark ? 0.5 : 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }}
      >
        <T variant="headline">{r.title}</T>
        {r.message ? (
          <T variant="subhead" color={c.text2} style={{ marginTop: 8 }}>
            {r.message}
          </T>
        ) : null}
        <View style={{ flexDirection: "row", marginTop: 20, gap: 8 }}>
          {single ? null : (
            <DialogButton label="취소" color={c.text} onPress={() => onAnswer(false)} />
          )}
          <DialogButton label={r.confirmLabel} color={r.destructive ? c.danger : c.primaryText} strong onPress={() => onAnswer(true)} />
        </View>
      </Animated.View>
      </View>
    </View>
  );
}

function DialogButton({ label, color, strong, onPress }: { label: string; color: string; strong?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.control, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.subtle : "transparent" })}
    >
      <T variant="body" color={color} style={{ fontWeight: strong ? "700" : "600" }}>
        {label}
      </T>
    </Pressable>
  );
}
