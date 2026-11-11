// Web preview only: native tabs render as a floating top bar on web, which
// covers the screen headers. Use a plain bottom tab bar for the preview.
import { Tabs } from "expo-router";
import { Icon } from "@/components/Icon";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { AppNotification } from "@/lib/types";
import { useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";

export default function TabsLayoutWeb() {
  const { c } = useTheme();
  const { group } = useSession();
  const { data } = useData(`unread:${group?.id ?? ""}`, () =>
    api<{ items: AppNotification[]; unreadCount: number }>("/api/notifications", { query: { groupId: group?.id } }),
  );
  const unread = data?.unreadCount ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.outline },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "캘린더", tabBarIcon: ({ color, focused }) => <Icon name="calendar" color={String(color)} filled={focused} /> }} />
      <Tabs.Screen name="summary" options={{ title: "일정 요약", tabBarIcon: ({ color, focused }) => <Icon name="list" color={String(color)} filled={focused} /> }} />
      <Tabs.Screen
        name="notifications"
        options={{ title: "알림", tabBarBadge: unread > 0 ? unread : undefined, tabBarIcon: ({ color, focused }) => <Icon name="bell" color={String(color)} filled={focused} /> }}
      />
      <Tabs.Screen name="settings" options={{ title: "설정", tabBarIcon: ({ color, focused }) => <Icon name="settings" color={String(color)} filled={focused} /> }} />
    </Tabs>
  );
}
