// Bottom tab bar from the design canvas: always-visible labels, accent color on the
// selected tab, hairline top edge. Same JS tab bar on every platform so it matches the
// canvas (the native Android bar hides labels of unselected tabs).
import { Tabs, usePathname, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Keyboard, PanResponder, Platform, Pressable, Text, useWindowDimensions, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { DismissLayer } from "@/components/DismissLayer";
import { QuickAddBar } from "@/components/QuickAddBar";
import { api, HOSTED_WEB } from "@/lib/api";
import { todayKey } from "@/lib/date";
import { permissionsFor } from "@/lib/permissions";
import { QuickAddDockProvider, TAB_BAR_H, TAB_BAR_TOP, useQuickAddDock, useTabBarBand } from "@/lib/quickAddDock";
import { useSession } from "@/lib/session";
import type { AppNotification } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";
import { webFont } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";
import { clampSplit, usePaneLeft, useWide, useWideMode, WideDayProvider } from "@/lib/wide";
import { DUR, EASE_IN, EASE_OUT, timeTo } from "@/lib/motion";
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
  const groupId = group?.id;
  useEffect(() => {
    if (!HOSTED_WEB || !groupId) return;
    const stream = new EventSource("/api/events/stream?groupId=" + encodeURIComponent(groupId));
    stream.onmessage = invalidate;
    return () => stream.close();
  }, [groupId]);
  useEffect(() => {
    if (!HOSTED_WEB || !data || !("setAppBadge" in navigator)) return;
    void (unread ? navigator.setAppBadge(unread) : navigator.clearAppBadge()).catch(() => {});
  }, [data, unread]);

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
      <Tabs.Screen name="settings" options={{ title: "설정", tabBarIcon: ({ color }) => <TabIcon name="settings" color={String(color)} /> }} />
    </Tabs>
  );

  if (!wide)
    return (
      <WideDayProvider>
        <QuickAddDockProvider>
          <View style={{ flex: 1, backgroundColor: c.surface }}>
            <View style={{ flex: 1 }}>{tabs}</View>
            <AppTabBar unread={unread} />
            <QuickAddDock />
          </View>
        </QuickAddDockProvider>
      </WideDayProvider>
    );

  // Unfolded / large screen: month on the left, the current tab on the right, one tab bar across
  // the whole width — or, switched to full screen, the phone layout across the whole width.
  // (The 분할 / 전체화면 mode itself is provided by the root layout: popups use it too.)
  return (
    <WideDayProvider>
      <QuickAddDockProvider>
        <WidePanes tabs={tabs} unread={unread} />
      </QuickAddDockProvider>
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
      <QuickAddDock />
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
  { href: "/settings", match: (p: string) => p.startsWith("/settings"), label: "설정", icon: "settings" },
] as const;

/**
 * The app's tab bar (phones and the unfolded layout): a rounded bar a little above the bottom
 * edge and in from the sides, with a soft shadow, and a + in the middle that brings out the quick
 * add bar. It floats over the page: lists scroll under it, and the calendar shows one more week of
 * the next month beneath it.
 */
function AppTabBar({ unread }: { unread: number }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const { group, me } = useSession();
  const canAdd = !!group && permissionsFor(group, me).canWriteEvents;
  const dock = useQuickAddDock();
  const wide = useWide();
  const { full } = useWideMode();
  const activeIndex = Math.max(0, WIDE_TABS.findIndex((t) => t.match(path)));
  // Floats over every page (not beside the calendar pane on a wide screen, where it spans both).
  const floating = !(wide && !full);
  // Page color behind the bar: the calendar is black in dark mode (CalendarView), the rest use bg.
  const pageBg = activeIndex === 0 ? (isDark ? "#000000" : c.surface) : c.bg;

  // + turns into × while the quick add bar is out.
  const [spin] = useState(() => new Animated.Value(dock.open ? 1 : 0));
  useEffect(() => {
    timeTo(spin, dock.open ? 1 : 0, dock.open ? DUR.open : DUR.close, dock.open ? EASE_OUT : EASE_IN);
  }, [dock.open, spin]);

  const tab = (t: (typeof WIDE_TABS)[number], i: number) => {
    const focused = i === activeIndex;
    const color = focused ? c.primaryText : c.text2;
    const badge = t.icon === "bell" && unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null;
    return (
      <Pressable
        key={t.href}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={badge ? `${t.label}, 읽지 않음 ${unread}개` : t.label}
        onPress={() => router.navigate(t.href)}
        style={({ pressed }) => ({ flex: 1, height: "100%", alignItems: "center", justifyContent: "center", gap: 3, opacity: pressed ? 0.6 : 1 })}
      >
        <View style={{ width: 56, height: 30, alignItems: "center", justifyContent: "center" }}>
          <ActivePill on={focused} color={c.primaryContainer} />
          <TabIcon name={t.icon} color={color} />
          {badge ? (
            <View style={{ position: "absolute", top: -3, right: 4, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: c.danger, borderWidth: 2, borderColor: c.card, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: c.onDanger, fontSize: 10, fontWeight: "700" }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ ...webFont, color, fontSize: 11, lineHeight: 14, fontWeight: focused ? "700" : "500" }}>{t.label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        { paddingHorizontal: 16, paddingTop: TAB_BAR_TOP, paddingBottom: Math.max(insets.bottom, 10) + 4 },
        floating ? { position: "absolute", left: 0, right: 0, bottom: 0 } : { backgroundColor: pageBg },
      ]}
    >
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: TAB_BAR_H,
          borderRadius: TAB_BAR_H / 2,
          backgroundColor: c.card,
          // Light: soft lift. Dark: a hairline edge reads better than a shadow on a dark page.
          borderWidth: isDark ? 1 : 0,
          borderColor: c.outline,
          shadowColor: "#0F172A",
          shadowOpacity: isDark ? 0 : floating ? 0.14 : 0.1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: isDark ? 0 : 10,
        }}
      >
        {WIDE_TABS.slice(0, 2).map((t, i) => tab(t, i))}
        {canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dock.open ? "빠른 일정 추가 닫기" : "빠른 일정 추가"}
            accessibilityState={{ expanded: dock.open }}
            onPress={() => {
              if (dock.open) Keyboard.dismiss();
              dock.toggle();
            }}
            style={{ flex: 1, height: "100%", alignItems: "center", justifyContent: "center" }}
          >
            {({ pressed }) => (
              <Animated.View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.primary,
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) }, { scale: pressed ? 0.94 : 1 }],
                }}
              >
                <Feather name="plus" size={26} color={c.onPrimary} />
              </Animated.View>
            )}
          </Pressable>
        ) : null}
        {WIDE_TABS.slice(2).map((t, i) => tab(t, i + 2))}
      </View>
    </View>
  );
}

/**
 * The quick add bar the tab bar's + brings out: it floats just above the tab bar on whatever tab
 * is open (fading and rising in), and goes away on the next +. On the calendar a line without a
 * date goes on the selected day; elsewhere on today.
 */
function QuickAddDock() {
  const { isDark } = useTheme();
  const dock = useQuickAddDock();
  const { group, me } = useSession();
  const canAdd = !!group && permissionsFor(group, me).canWriteEvents;
  const band = useTabBarBand();
  // Split screen (unfolded): over the calendar pane on the left only, whatever the right shows.
  const paneLeft = usePaneLeft();
  const { width } = useWindowDimensions();
  const path = usePathname();
  const onCalendar = paneLeft > 0 || WIDE_TABS[0].match(path);
  // Keep room for the text field between AI, microphone and submit on small phones/panes.
  const dockWidth = paneLeft || width;
  const dockInset = Math.max(8, Math.min(48, (dockWidth - 280) / 2));
  // Typing: a tap anywhere else only ends typing.
  const [typing, setTyping] = useState(false);
  // Stays mounted through the closing animation.
  const [shown, setShown] = useState(dock.open);
  if (dock.open && !shown) setShown(true);
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (dock.open) timeTo(p, 1, DUR.open, EASE_OUT);
    else timeTo(p, 0, DUR.close, EASE_IN, true, () => setShown(false));
  }, [dock.open, p]);

  if (!shown || !canAdd) return null;
  return (
    <>
      {typing ? <DismissLayer /> : null}
      {/* Full-screen layer (touches pass through) so the card lifted over the keyboard stays
          inside its parent and taps in the field reach it on Android. */}
      <Animated.View
        pointerEvents={dock.open ? "box-none" : "none"}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: paneLeft > 0 ? width - paneLeft : 0,
          bottom: band,
          paddingHorizontal: dockInset,
          paddingBottom: 10,
          opacity: p,
          transformOrigin: "bottom",
          transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        }}
      >
        <QuickAddBar fill date={onCalendar ? dock.date : todayKey()} widen={dockInset - 8} onActiveChange={setTyping} surface={isDark && onCalendar ? "#1E1E1E" : undefined} aiToggle />
      </Animated.View>
    </>
  );
}

/**
 * The selected tab's soft accent pill behind its icon (label stays below). It grows out from the
 * middle when the tab is picked and shrinks away when another one is.
 */
function ActivePill({ on, color }: { on: boolean; color: string }) {
  const [p] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    timeTo(p, on ? 1 : 0, on ? DUR.open : DUR.close, on ? EASE_OUT : EASE_IN);
  }, [on, p]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 15,
        backgroundColor: color,
        opacity: p,
        transform: [{ scaleX: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
      }}
    />
  );
}

/** Feather line icons (calendar, list, bell); 설정 is Ionicons' rounded outline gear. */
function TabIcon({ name, color }: { name: "calendar" | "list" | "bell" | "settings"; color: string }) {
  return (
    <View style={{ width: 30, height: 26, alignItems: "center", justifyContent: "center" }}>
      {name === "settings" ? <Ionicons name="settings-outline" size={23} color={color} /> : <Feather name={name} size={22} color={color} />}
    </View>
  );
}
