// Bottom tab bar from the design canvas: always-visible labels, accent color on the
// selected tab, hairline top edge. Same JS tab bar on every platform so it matches the
// canvas (the native Android bar hides labels of unselected tabs).
import { Tabs, usePathname, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, Platform, Pressable, Text, useWindowDimensions, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { AppNotification } from "@/lib/types";
import { useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { clampSplit, useWide, useWideMode, WideDayProvider } from "@/lib/wide";
import { DUR, EASE_IN, SPRING_LEAD, SPRING_TRAIL, springTo, timeTo } from "@/lib/motion";
import { CalendarView } from "./index";

const android = Platform.OS === "android";

export default function TabsLayout() {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { group } = useSession();
  const { data } = useData(`unread:${group?.id ?? ""}`, () =>
    api<{ items: AppNotification[]; unreadCount: number }>("/api/notifications", { query: { groupId: group?.id } }),
  );
  const unread = data?.unreadCount ?? 0;

  const label = ({ color, focused, children }: { color: ColorValue; focused: boolean; children: string }) => (
    <Text style={{ color, fontSize: 10, lineHeight: 14, fontWeight: focused ? "700" : "500", marginTop: android ? 4 : 2 }}>{children}</Text>
  );

  const wide = useWide();

  const tabs = (
    <Tabs
      // One shared tab bar (below) for both layouts, so the active pill can slide between tabs.
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        // Every tab always shows its label; the selected one takes the accent color (both platforms).
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.text2,
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarLabel: label,
        tabBarStyle: {
          // Height = top padding + icon/label block (iOS 28+2+16, Android 32+4+16) + bottom inset.
          height: (android ? 10 + 54 : 8 + 48) + Math.max(insets.bottom, 12),
          paddingTop: android ? 10 : 8,
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: c.surface,
          // Square edge with a hairline on top (canvas: 1px #0000001E, no radius).
          borderTopWidth: 1,
          borderTopColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBadgeStyle: { backgroundColor: c.danger, color: c.onDanger, fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "캘린더", tabBarIcon: ({ color }) => <TabIcon name="calendar" color={String(color)} /> }} />
      <Tabs.Screen name="summary" options={{ title: "일정 요약", tabBarIcon: ({ color }) => <TabIcon name="list" color={String(color)} /> }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "알림",
          tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
          tabBarAccessibilityLabel: unread > 0 ? `알림, 읽지 않음 ${unread}개` : "알림",
          tabBarIcon: ({ color }) => <TabIcon name="bell" color={String(color)} />,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: "설정", tabBarIcon: ({ color }) => <TabIcon name="sliders" color={String(color)} /> }} />
    </Tabs>
  );

  if (!wide)
    return (
      <WideDayProvider>
        <View style={{ flex: 1, backgroundColor: c.surface }}>
          <View style={{ flex: 1 }}>{tabs}</View>
          <AppTabBar unread={unread} />
        </View>
      </WideDayProvider>
    );

  // Unfolded / large screen: month on the left, the current tab on the right, one tab bar across
  // the whole width — or, switched to full screen, the phone layout across the whole width.
  // (The 분할 / 전체화면 mode itself is provided by the root layout: popups use it too.)
  return (
    <WideDayProvider>
      <WidePanes tabs={tabs} unread={unread} />
    </WideDayProvider>
  );
}

function WidePanes({ tabs, unread }: { tabs: ReactNode; unread: number }) {
  const { c } = useTheme();
  const { full, progress, split, setSplit } = useWideMode();
  const { width } = useWindowDimensions();
  // The calendar's share of the width (split). The divider drags it live; the saved value
  // (and a fold / rotate that changes the width) puts it back in range.
  const [ratio] = useState(() => new Animated.Value(clampSplit(split)));
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) ratio.setValue(clampSplit(split));
  }, [ratio, split]);
  // Calendar width: ratio·W when split, growing to the whole width while switching to full screen.
  const calW = Animated.multiply(Animated.add(ratio, Animated.multiply(progress, Animated.subtract(1, ratio))), width);
  const tabsW = Animated.multiply(Animated.subtract(1, ratio), width);
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ flex: 1, flexDirection: "row", overflow: "hidden" }}>
        {/* Keyed so the tabs pane keeps its screens when the calendar pane comes and goes.
            While switching, the calendar pane's width runs from its split width to the whole
            screen and the right pane slides out / in beside it (see WideModeProvider). */}
        {full ? null : (
          <Animated.View key="calendar" style={{ width: calW }}>
            <CalendarView pane />
          </Animated.View>
        )}
        <Animated.View
          key="tabs"
          style={
            full
              ? { flex: 1 }
              : {
                  width: tabsW,
                  opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.2, 0] }),
                  transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 48] }) }],
                }
          }
        >
          {tabs}
        </Animated.View>
        {full ? null : (
          <SplitDivider
            ratio={ratio}
            width={width}
            progress={progress}
            onDragState={(on) => {
              dragging.current = on;
            }}
            onCommit={setSplit}
          />
        )}
      </View>
      <AppTabBar unread={unread} />
    </View>
  );
}

const DIVIDER_HIT = 28;

/**
 * The line between the panes, with a grip in the middle: drag it to give the calendar more or less
 * room (half … two thirds of the width).
 */
function SplitDivider({
  ratio,
  width,
  progress,
  onDragState,
  onCommit,
}: {
  ratio: Animated.Value;
  width: number;
  progress: Animated.Value;
  onDragState: (dragging: boolean) => void;
  onCommit: (ratio: number) => void;
}) {
  const { c, isDark } = useTheme();
  const [active, setActive] = useState(false);
  const [grip] = useState(() => new Animated.Value(0));
  // Gesture state, read only in the handlers.
  const start = useRef(0);
  const cur = useRef(0);
  const props = useRef({ width, onDragState, onCommit });
  useLayoutEffect(() => {
    props.current = { width, onDragState, onCommit };
  });
  useEffect(() => {
    const id = ratio.addListener(({ value }) => {
      cur.current = value;
    });
    return () => ratio.removeListener(id);
  }, [ratio]);

  const step = (r: number) => {
    const next = clampSplit(r);
    ratio.setValue(next);
    props.current.onCommit(next);
  };

  /* eslint-disable react-hooks/refs -- handlers only read refs when a gesture event fires */
  const [pan] = useState(() => {
    const end = () => {
      props.current.onCommit(cur.current);
      props.current.onDragState(false);
      setActive(false);
      timeTo(grip, 0, DUR.close, EASE_IN);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        ratio.stopAnimation();
        start.current = cur.current;
        props.current.onDragState(true);
        setActive(true);
        timeTo(grip, 1, DUR.swap);
      },
      onPanResponderMove: (_, g) => {
        ratio.setValue(clampSplit(start.current + g.dx / Math.max(props.current.width, 1)));
      },
      onPanResponderRelease: () => end(),
      onPanResponderTerminate: () => end(),
    });
  });
  /* eslint-enable react-hooks/refs */

  const line = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  return (
    <Animated.View
      {...pan.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="캘린더 너비 조절"
      accessibilityHint="드래그해서 캘린더와 오른쪽 화면의 너비를 바꿔요"
      accessibilityActions={[
        { name: "increment", label: "캘린더 넓게" },
        { name: "decrement", label: "캘린더 좁게" },
      ]}
      onAccessibilityAction={(e) => step(cur.current + (e.nativeEvent.actionName === "increment" ? 0.05 : -0.05))}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        width: DIVIDER_HIT,
        left: Animated.subtract(Animated.multiply(ratio, width), DIVIDER_HIT / 2),
        alignItems: "center",
        justifyContent: "center",
        // Gone while switching to full screen.
        opacity: progress.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: "clamp" }),
      }}
    >
      <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: DIVIDER_HIT / 2 - 0.5, width: 1, backgroundColor: active ? c.primary : line }} />
      <Animated.View
        pointerEvents="none"
        style={{
          width: 6,
          height: 44,
          borderRadius: 3,
          backgroundColor: active ? c.primary : c.outline,
          transform: [{ scaleY: grip.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }, { scaleX: grip.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }],
        }}
      />
    </Animated.View>
  );
}

const WIDE_TABS = [
  { href: "/", match: (p: string) => p === "/" || p === "", label: "캘린더", icon: "calendar" },
  { href: "/summary", match: (p: string) => p.startsWith("/summary"), label: "일정 요약", icon: "list" },
  { href: "/notifications", match: (p: string) => p.startsWith("/notifications"), label: "알림", icon: "bell" },
  { href: "/settings", match: (p: string) => p.startsWith("/settings"), label: "설정", icon: "sliders" },
] as const;

/**
 * The app's tab bar (phones and the unfolded layout). On Android the active pill is one
 * element that slides to the tapped tab: its edges ride different springs, so it stretches
 * toward the new tab and settles. No press ripple.
 */
function AppTabBar({ unread }: { unread: number }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const activeIndex = Math.max(0, WIDE_TABS.findIndex((t) => t.match(path)));
  const [slots, setSlots] = useState<{ x: number; w: number }[]>([]);
  const [left] = useState(() => new Animated.Value(-1));
  const [right] = useState(() => new Animated.Value(-1));
  const placed = useRef<number | null>(null);
  const slot = slots[activeIndex];
  useEffect(() => {
    if (!slot) return;
    const l = slot.x + slot.w / 2 - PILL_W / 2;
    const r = l + PILL_W;
    if (placed.current === null) {
      left.setValue(l);
      right.setValue(r);
    } else {
      const toRight = activeIndex > placed.current;
      springTo(left, l, toRight ? SPRING_TRAIL : SPRING_LEAD);
      springTo(right, r, toRight ? SPRING_LEAD : SPRING_TRAIL);
    }
    placed.current = activeIndex;
  }, [slot, activeIndex, left, right]);

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        height: (android ? 10 + 54 : 8 + 48) + Math.max(insets.bottom, 12),
        paddingTop: android ? 10 : 8,
        paddingBottom: Math.max(insets.bottom, 12),
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
      }}
    >
      {android && slot ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", top: 10, height: 32, left, width: Animated.subtract(right, left), borderRadius: 16, backgroundColor: c.primaryContainer }}
        />
      ) : null}
      {WIDE_TABS.map((t, i) => {
        const focused = i === activeIndex;
        const color = focused ? c.primaryText : c.text2;
        const badge = t.icon === "bell" && unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null;
        return (
          <Pressable
            key={t.href}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setSlots((prev) => {
                if (prev[i]?.x === x && prev[i]?.w === width) return prev;
                const next = [...prev];
                next[i] = { x, w: width };
                return next;
              });
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${t.label}, 읽지 않음 ${unread}개` : t.label}
            onPress={() => router.navigate(t.href)}
            style={{ flex: 1, alignItems: "center", justifyContent: "flex-start" }}
          >
            <View>
              <TabIcon name={t.icon} color={color} />
              {badge ? (
                <View style={{ position: "absolute", top: -4, right: android ? 6 : -10, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: c.danger, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: c.onDanger, fontSize: 12, fontWeight: "700" }}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color, fontSize: 10, lineHeight: 14, fontWeight: focused ? "700" : "500", marginTop: android ? 4 : 2 }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const PILL_W = 64;

/**
 * Feather line icons — the same set the design canvas draws (calendar, list, bell, sliders).
 * On Android the active pill behind it is drawn by the tab bar (it slides between tabs).
 */
function TabIcon({ name, color }: { name: "calendar" | "list" | "bell" | "sliders"; color: string }) {
  return (
    <View style={{ width: android ? PILL_W : 30, height: android ? 32 : 28, alignItems: "center", justifyContent: "center" }}>
      <Feather name={name} size={20} color={color} />
    </View>
  );
}
