// Pull down to refresh, the same on the phone app and the phone web app.
// - App: the platform RefreshControl, as before.
// - Web: react-native-web's RefreshControl does nothing, but its ScrollView still hands the list to
//   `refreshControl` as its child, so this drop-in wraps the list in a View that watches touches:
//   pulled down from the top far enough → `onRefresh`, with a badge that follows the finger.
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, Platform, RefreshControl, View, type RefreshControlProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";

/** How far (px, after damping) the finger has to pull before letting go refreshes. */
export const PULL_TRIGGER = 64;
/** Where the badge stops while it spins. */
const REST_Y = 14;
const BADGE = 36;

/** The round badge at the top: an arrow that turns as the pull nears the trigger, then a spinner. */
export function RefreshBadge({ pull, spinning }: { pull: number; spinning: boolean }) {
  const { c, isDark } = useTheme();
  const ready = pull >= PULL_TRIGGER;
  return (
    <View
      style={{
        width: BADGE,
        height: BADGE,
        borderRadius: BADGE / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.card,
        shadowColor: "#0F172A",
        shadowOpacity: isDark ? 0.5 : 0.16,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      {spinning ? (
        <ActivityIndicator size="small" color={c.primary} />
      ) : (
        <View style={{ transform: [{ rotate: ready ? "180deg" : "0deg" }] }}>
          <Icon name="pull" size={20} color={ready ? c.primary : c.text2} />
        </View>
      )}
    </View>
  );
}

export function PullRefresh(props: RefreshControlProps & { children?: ReactNode }) {
  if (Platform.OS !== "web") return <RefreshControl {...props} />;
  return <WebPullRefresh {...props} />;
}

function WebPullRefresh({ refreshing, onRefresh, enabled = true, style, children }: RefreshControlProps & { children?: ReactNode }) {
  const box = useRef<ComponentRef<typeof View>>(null);
  const [pull, setPull] = useState(0);
  const live = useRef({ startY: 0, pulling: false, pull: 0 });
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  });

  useEffect(() => {
    const node = box.current as unknown as HTMLElement | null;
    if (!node || !enabled) return;
    // Pull only when everything between the finger and this box is scrolled to the top.
    const atTop = (target: EventTarget | null) => {
      for (let el = target as HTMLElement | null; el && el !== node; el = el.parentElement) {
        if (el.scrollTop > 0) return false;
      }
      return true;
    };
    const set = (v: number) => {
      live.current.pull = v;
      setPull(v);
    };
    const start = (e: TouchEvent) => {
      live.current.pulling = e.touches.length === 1 && atTop(e.target);
      live.current.startY = e.touches[0]?.clientY ?? 0;
    };
    const move = (e: TouchEvent) => {
      if (!live.current.pulling) return;
      const dy = (e.touches[0]?.clientY ?? 0) - live.current.startY;
      if (dy <= 0) {
        if (live.current.pull) set(0);
        return;
      }
      // Damped: the badge moves about half as far as the finger, and stops a little past the trigger.
      set(Math.min(PULL_TRIGGER * 1.6, dy * 0.5));
    };
    const end = () => {
      if (!live.current.pulling) return;
      live.current.pulling = false;
      if (live.current.pull >= PULL_TRIGGER) refreshRef.current?.();
      set(0);
    };
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: true });
    node.addEventListener("touchend", end);
    node.addEventListener("touchcancel", end);
    return () => {
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", end);
    };
  }, [enabled]);

  const shown = refreshing || pull > 0;
  const y = refreshing && pull === 0 ? REST_Y : pull - BADGE;
  return (
    <View ref={box} style={[{ flex: 1 }, style]}>
      {children}
      {shown ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            alignItems: "center",
            opacity: refreshing ? 1 : Math.min(1, pull / PULL_TRIGGER),
            transform: [{ translateY: Math.max(-BADGE, y) }],
          }}
        >
          <RefreshBadge pull={pull} spinning={!!refreshing} />
        </View>
      ) : null}
    </View>
  );
}
