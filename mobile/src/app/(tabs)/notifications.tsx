import { useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { MarqueeText } from "@/components/MarqueeText";
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
  const { group } = useSession();
  const { data, error, loading, refreshing, refresh } = useData(`unread:${group?.id ?? ""}`, () =>
    api<{ items: AppNotification[]; unreadCount: number }>("/api/notifications", { query: { groupId: group?.id } }),
  );
  // Tapped notifications show as read at once (dot gone, title normal weight) — not only after the
  // server answers and the list reloads, which used to happen hidden behind the day popup.
  const [readNow, setReadNow] = useState<Set<string>>(() => new Set());
  const isRead = (n: AppNotification) => !!n.readAt || readNow.has(n.id);

  const items = data?.items ?? [];
  const unread = Math.max(0, (data?.unreadCount ?? 0) - items.filter((i) => !i.readAt && readNow.has(i.id)).length);
  const today = todayKey();
  const yesterday = addDays(today, -1);

  function open(n: AppNotification) {
    if (!isRead(n)) {
      setReadNow((cur) => new Set(cur).add(n.id));
      void api(`/api/notifications/${n.id}/read`, { method: "POST" })
        .catch(() => null)
        .then(() => invalidate());
    }
    // A tap only marks it read — it doesn't open the day.
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
            <T variant="body" color={unread === 0 ? c.muted : c.primaryText} style={{ fontSize: 15, fontWeight: "600" }}>
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
            const isUnread = !isRead(n);
            return (
              <View style={{ gap: 8 }}>
                {heading ? (
                  <T variant="footnote" color={c.text2} accessibilityRole="header" style={{ marginTop: index ? 8 : 0, marginLeft: 2, fontSize: 13, fontWeight: "700" }}>
                    {heading}
                  </T>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${isUnread ? "읽지 않음, " : ""}${n.title}, ${n.body}, ${timeAgo(n.createdAt)}`}
                  accessibilityHint={isUnread ? "읽음으로 표시" : undefined}
                  onPress={() => open(n)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "flex-start",
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    borderRadius: radius.card,
                    backgroundColor: pressed ? c.subtle : c.card,
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: k.bg, alignItems: "center", justifyContent: "center" }}>
                    <T variant="subhead" style={{ fontWeight: "700" }} color={k.fg}>
                      {k.glyph}
                    </T>
                  </View>
                  {/* Line 1: title … time at the far right. Line 2: body, one line; a body longer than the
                      card slides slowly left so all of it can be read (canvas sizes 13 / 13 / 11). */}
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {/* Titles are short labels (새 일정 등록, 특근 가능 요청 …) — plain text, no scrolling. */}
                      <T variant="footnote" numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, fontWeight: isUnread ? "700" : "500" }}>
                        {n.title}
                      </T>
                      <T variant="footnote" color={c.muted} numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, fontWeight: "500" }}>
                        {timeAgo(n.createdAt)}
                      </T>
                    </View>
                    <MarqueeText variant="caption" color={c.text2} style={{ fontSize: 11, lineHeight: 16, fontWeight: "400" }}>
                      {n.body}
                    </MarqueeText>
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
