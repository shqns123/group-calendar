import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Empty, ErrorBanner, Loading, T } from "@/components/ui";
import { api } from "@/lib/api";
import { toKey, todayKey, addDays } from "@/lib/date";
import { useSession } from "@/lib/session";
import type { AppNotification } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

function kind(n: AppNotification, dark: boolean) {
  const t = n.type.toUpperCase();
  const pick = (glyph: string, lightBg: string, lightFg: string, darkBg: string, darkFg: string) => ({ glyph, bg: dark ? darkBg : lightBg, fg: dark ? darkFg : lightFg });
  if (t.includes("OVERTIME")) return pick("특", "#FEF3C7", "#92400E", "#422006", "#FCD34D");
  if (t.includes("JOIN") || t.includes("PENDING") || t.includes("MEMBER")) return pick("가", "#DCFCE7", "#166534", "#052E16", "#86EFAC");
  if (t.includes("NOTE") || t.includes("MEMO")) return pick("메", "#F1F5F9", "#334155", "#334155", "#E2E8F0");
  if (n.eventCategory === "ATTENDANCE") return pick("휴", "#EDE9FE", "#6D28D9", "#2E1065", "#DDD6FE");
  return pick("출", "#DBEAFE", "#1D4ED8", "#1E3A8A", "#BFDBFE");
}

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return d === 1 ? "어제" : `${d}일 전`;
}

export default function NotificationsScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const { group } = useSession();
  const { data, error, loading, refreshing, refresh } = useData(`unread:${group?.id ?? ""}`, () =>
    api<{ items: AppNotification[]; unreadCount: number }>("/api/notifications", { query: { groupId: group?.id } }),
  );
  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;
  const today = todayKey();
  const yesterday = addDays(today, -1);

  async function open(n: AppNotification) {
    if (!n.readAt) {
      await api(`/api/notifications/${n.id}/read`, { method: "POST" }).catch(() => null);
      invalidate();
    }
    if (n.targetDate) router.push({ pathname: "/day/[date]", params: { date: n.targetDate.slice(0, 10) } });
  }

  async function readAll() {
    await api("/api/notifications/read-all", { method: "POST", body: { notificationIds: items.filter((i) => !i.readAt).map((i) => i.id) } }).catch(() => null);
    invalidate();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader
        title="알림"
        trailing={
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: unread === 0 }} disabled={unread === 0} onPress={readAll} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: "center" }}>
            <T variant="body" color={unread === 0 ? c.muted : c.primaryText}>
              모두 읽음
            </T>
          </Pressable>
        }
      />
      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
          ListEmptyComponent={<Empty title="새 알림이 없어요" body="일정이 등록되거나 바뀌면 여기에 표시돼요." />}
          renderItem={({ item: n, index }) => {
            const day = toKey(n.createdAt);
            const prevDay = index > 0 ? toKey(items[index - 1].createdAt) : null;
            const heading = day !== prevDay ? (day === today ? "오늘" : day === yesterday ? "어제" : `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`) : null;
            const k = kind(n, isDark);
            const isUnread = !n.readAt;
            return (
              <View style={{ gap: 8 }}>
                {heading ? (
                  <T variant="footnote" color={c.text2} accessibilityRole="header" style={{ marginTop: index ? 8 : 0, marginLeft: 2 }}>
                    {heading}
                  </T>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${isUnread ? "읽지 않음, " : ""}${n.title}, ${n.body}, ${timeAgo(n.createdAt)}`}
                  onPress={() => void open(n)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: 14,
                    borderRadius: radius.card,
                    borderWidth: 1,
                    borderColor: c.outline,
                    backgroundColor: pressed ? c.subtle : isUnread ? c.card : c.sheet,
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: k.bg, alignItems: "center", justifyContent: "center" }}>
                    <T variant="subhead" style={{ fontWeight: "700" }} color={k.fg}>
                      {k.glyph}
                    </T>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <T variant="headline" style={{ flexShrink: 1, fontWeight: isUnread ? "700" : "500" }}>
                        {n.title}
                      </T>
                      <T variant="footnote" color={c.muted} style={{ fontWeight: "500" }}>
                        {timeAgo(n.createdAt)}
                      </T>
                    </View>
                    <T variant="subhead" color={c.text2}>
                      {n.body}
                    </T>
                  </View>
                  {isUnread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary, marginTop: 7 }} /> : null}
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
