// Bottom tab bar from the design canvas: always-visible labels, accent color on the
// selected tab, hairline top edge. Same JS tab bar on every platform so it matches the
// canvas (the native Android bar hides labels of unselected tabs).
import { Tabs, usePathname, useRouter } from "expo-router";
import { Platform, Pressable, Text, View, type ColorValue, type PressableProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { AppNotification } from "@/lib/types";
import { useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { useWide, WideDayProvider } from "@/lib/wide";
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
    <Text style={{ color, fontSize: 12, lineHeight: 16, fontWeight: focused ? "700" : "500", marginTop: android ? 4 : 2 }}>{children}</Text>
  );

  const wide = useWide();

  const tabs = (
    <Tabs
      // Wide layout draws its own full-width tab bar under both panes (below).
      tabBar={wide ? () => null : undefined}
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
        // No gray press ripple/highlight on the tab buttons (transparent press).
        tabBarButton: (props) => <PlainTabButton {...props} />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "캘린더", tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen name="summary" options={{ title: "일정 요약", tabBarIcon: ({ color, focused }) => <TabIcon name="list" color={String(color)} focused={focused} /> }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "알림",
          tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
          tabBarAccessibilityLabel: unread > 0 ? `알림, 읽지 않음 ${unread}개` : "알림",
          tabBarIcon: ({ color, focused }) => <TabIcon name="bell" color={String(color)} focused={focused} />,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: "설정", tabBarIcon: ({ color, focused }) => <TabIcon name="sliders" color={String(color)} focused={focused} /> }} />
    </Tabs>
  );

  if (!wide) return <WideDayProvider>{tabs}</WideDayProvider>;

  // Unfolded / large screen: month on the left (always), the current tab on the right,
  // one tab bar across the whole width.
  return (
    <WideDayProvider>
      <View style={{ flex: 1, backgroundColor: c.surface }}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }}>
            <CalendarView pane />
          </View>
          <View style={{ flex: 1 }}>{tabs}</View>
        </View>
        <WideTabBar unread={unread} />
      </View>
    </WideDayProvider>
  );
}

const WIDE_TABS = [
  { href: "/", match: (p: string) => p === "/" || p === "", label: "캘린더", icon: "calendar" },
  { href: "/summary", match: (p: string) => p.startsWith("/summary"), label: "일정 요약", icon: "list" },
  { href: "/notifications", match: (p: string) => p.startsWith("/notifications"), label: "알림", icon: "bell" },
  { href: "/settings", match: (p: string) => p.startsWith("/settings"), label: "설정", icon: "sliders" },
] as const;

/** Full-width tab bar for the wide layout; switching tabs only changes the right pane. */
function WideTabBar({ unread }: { unread: number }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
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
      {WIDE_TABS.map((t) => {
        const focused = t.match(path);
        const color = focused ? c.primaryText : c.text2;
        const badge = t.icon === "bell" && unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null;
        return (
          <Pressable
            key={t.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${t.label}, 읽지 않음 ${unread}개` : t.label}
            onPress={() => router.navigate(t.href)}
            style={{ flex: 1, alignItems: "center", justifyContent: "flex-start" }}
          >
            <View>
              <TabIcon name={t.icon} color={color} focused={focused} />
              {badge ? (
                <View style={{ position: "absolute", top: -4, right: android ? 6 : -10, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: c.danger, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: c.onDanger, fontSize: 12, fontWeight: "700" }}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color, fontSize: 12, lineHeight: 16, fontWeight: focused ? "700" : "500", marginTop: android ? 4 : 2 }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Feather line icons — the same set the design canvas draws (calendar, list, bell, sliders).
 * Android keeps the Material active pill behind the icon; iOS colors the icon only.
 */
function TabIcon({ name, color, focused }: { name: "calendar" | "list" | "bell" | "sliders"; color: string; focused: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: android ? 64 : 30,
        height: android ? 32 : 28,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused && android ? c.primaryContainer : "transparent",
      }}
    >
      <Feather name={name} size={24} color={color} />
    </View>
  );
}

/** Tab button without the Android ripple / press highlight. */
function PlainTabButton(props: object) {
  // The tab bar passes its own button props (incl. android_ripple and a web-only href); drop those.
  const { android_ripple: _ripple, href: _href, ...rest } = props as PressableProps & { href?: string };
  return <Pressable {...rest} android_ripple={undefined} />;
}
