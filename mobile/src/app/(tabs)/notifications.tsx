import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Animated, FlatList, Modal, Pressable, RefreshControl, useWindowDimensions, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { MarqueeText } from "@/components/MarqueeText";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Empty, ErrorBanner, Loading, T } from "@/components/ui";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { DUR, EASE_IN, EASE_OUT, timeTo } from "@/lib/motion";
import { useTabBarSpace } from "@/lib/quickAddDock";
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

/** Notification tabs: 전체, plus one per kind (근태 / 출장 by the event's category, 승인대기 = join requests). */
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "attendance", label: "근태" },
  { key: "trip", label: "출장" },
  { key: "pending", label: "승인대기" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function matches(n: AppNotification, f: FilterKey) {
  if (f === "all") return true;
  if (f === "attendance") return n.eventCategory === "ATTENDANCE";
  if (f === "trip") return n.eventCategory === "BUSINESS_TRIP";
  const t = n.type.toUpperCase();
  return t.includes("JOIN") || t.includes("PENDING");
}

const EMPTY: Record<FilterKey, string> = {
  all: "새 알림이 없어요",
  attendance: "근태 알림이 없어요",
  trip: "출장 알림이 없어요",
  pending: "승인을 기다리는 요청이 없어요",
};

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

  const all = data?.items ?? [];
  const [filter, setFilter] = useState<FilterKey>("all");
  const items = filter === "all" ? all : all.filter((n) => matches(n, filter));
  const unread = Math.max(0, (data?.unreadCount ?? 0) - all.filter((i) => !i.readAt && readNow.has(i.id)).length);
  const unreadIn = (f: FilterKey) => all.filter((n) => matches(n, f) && !isRead(n)).length;
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
    await api("/api/notifications/read-all", { method: "POST", body: { notificationIds: all.filter((i) => !i.readAt).map((i) => i.id) } }).catch(() => null);
    invalidate();
  }

  async function clearAll() {
    if (!(await confirm("알림 모두 삭제", `알림 ${all.length}개를 모두 지울까요? 지운 알림은 되돌릴 수 없어요.`, "삭제", true))) return;
    await api("/api/notifications/clear-all", { method: "POST", body: { groupId: group?.id } }).catch(() => null);
    invalidate();
  }

  const barSpace = useTabBarSpace();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="알림" />
      {/* 전체 / 근태 / 출장 / 승인대기, with each tab's unread count. */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
      <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: "row", gap: 6 }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const count = f.key === "all" ? 0 : unreadIn(f.key);
          return (
            <Pressable
              key={f.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={count ? `${f.label}, 읽지 않음 ${count}개` : f.label}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => ({
                minHeight: 36,
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: on ? c.text : pressed ? c.fill : c.card,
              })}
            >
              <T variant="subhead" color={on ? c.surface : c.text} style={{ fontSize: 14, fontWeight: on ? "700" : "500" }}>
                {f.label}
              </T>
              {count ? (
                <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: c.danger, alignItems: "center", justifyContent: "center" }}>
                  <T variant="caption" color={c.onDanger} style={{ fontSize: 11, fontWeight: "700" }}>
                    {count > 99 ? "99+" : count}
                  </T>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <MoreMenu
        items={[
          { key: "read", label: "모두 읽음", icon: "check-circle", disabled: unread === 0, onPress: readAll },
          { key: "clear", label: "모두 삭제", icon: "trash-2", danger: true, disabled: all.length === 0, onPress: clearAll },
        ]}
      />
      </View>
      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16, paddingBottom: barSpace, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
          ListEmptyComponent={<Empty title={EMPTY[filter]} body={filter === "pending" ? "가입 요청이 오면 여기에 표시돼요." : "일정이 등록되거나 바뀌면 여기에 표시돼요."} />}
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

type MenuItem = { key: string; label: string; icon: "check-circle" | "trash-2"; danger?: boolean; disabled?: boolean; onPress: () => void };

/**
 * ⋮ button with a small popup menu under it: grows out of the button's corner (fade + scale), and
 * shrinks back on a pick, a tap outside, or back.
 */
function MoreMenu({ items }: { items: MenuItem[] }) {
  const { c, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const btn = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (open) timeTo(p, 1, DUR.open, EASE_OUT);
  }, [open, p]);

  function show() {
    btn.current?.measureInWindow((x, y, w, h) => {
      setAt({ top: y + h + 4, right: Math.max(8, width - (x + w)) });
      p.setValue(0);
      setOpen(true);
    });
  }
  function hide(then?: () => void) {
    timeTo(p, 0, DUR.close, EASE_IN, true, () => {
      setOpen(false);
      then?.();
    });
  }

  return (
    <>
      <View ref={btn} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="알림 메뉴"
          accessibilityState={{ expanded: open }}
          onPress={show}
          hitSlop={4}
          style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: pressed || open ? c.fill : "transparent" })}
        >
          <Feather name="more-vertical" size={20} color={c.text2} />
        </Pressable>
      </View>
      <Modal visible={open} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => hide()}>
        <Pressable accessibilityLabel="메뉴 닫기" onPress={() => hide()} style={{ flex: 1 }}>
          {at ? (
            <Animated.View
              accessibilityRole="menu"
              style={{
                position: "absolute",
                top: at.top,
                right: at.right,
                minWidth: 168,
                paddingVertical: 6,
                borderRadius: 18,
                backgroundColor: c.card,
                borderWidth: isDark ? 1 : 0,
                borderColor: c.outline,
                shadowColor: "#0F172A",
                shadowOpacity: isDark ? 0 : 0.16,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
                opacity: p,
                transformOrigin: "top right",
                transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }, { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
              }}
            >
              {items.map((it) => {
                const color = it.disabled ? c.muted : it.danger ? c.danger : c.text;
                return (
                  <Pressable
                    key={it.key}
                    accessibilityRole="menuitem"
                    accessibilityState={{ disabled: !!it.disabled }}
                    disabled={it.disabled}
                    onPress={() => hide(it.onPress)}
                    style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: pressed ? c.fill : "transparent" })}
                  >
                    <Feather name={it.icon} size={18} color={color} />
                    <T variant="body" color={color} style={{ fontSize: 15, fontWeight: "600" }}>
                      {it.label}
                    </T>
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
