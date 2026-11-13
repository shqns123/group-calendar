import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Animated, LayoutAnimation, Pressable, RefreshControl, SectionList, View } from "react-native";
import { Icon } from "@/components/Icon";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Empty, ErrorBanner, Loading, T, Tag } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays, dotted, keyToIso, longLabel, parseKey, todayKey, toKey, WEEKDAYS, weekday } from "@/lib/date";
import { splitList } from "@/lib/roster";
import { useSession } from "@/lib/session";
import type { CalEvent } from "@/lib/types";
import { DUR, EASE_OUT, prefersReducedMotion, timeTo } from "@/lib/motion";
import { useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

type Bucket = "today" | "tomorrow" | "week" | "month" | "later";
const LABEL: Record<Bucket, string> = { today: "오늘", tomorrow: "내일", week: "이번 주", month: "이번 달", later: "다음 달 이후" };

export default function SummaryScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { group } = useSession();
  const today = todayKey();
  const horizon = addDays(today, 92);
  const [closed, setClosed] = useState<Set<Bucket>>(new Set(["month", "later"]));

  const { data, error, loading, refreshing, refresh } = useData(group ? `summary:${group.id}:${today}` : null, () =>
    api<CalEvent[]>("/api/events", { query: { groupId: group!.id, start: keyToIso(today), end: keyToIso(horizon) } }),
  );

  const sections = useMemo(() => {
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, 6 - weekday(today));
    const { year, month } = parseKey(today);
    const buckets: Record<Bucket, CalEvent[]> = { today: [], tomorrow: [], week: [], month: [], later: [] };
    for (const e of data ?? []) {
      // Summary lists 근태 and 출장 only; 특근 marks (available or not) are left out.
      if (e.isOvertimeOnly) continue;
      const s = toKey(e.startDate) < today ? today : toKey(e.startDate);
      const p = parseKey(s);
      const b: Bucket = s === today ? "today" : s === tomorrow ? "tomorrow" : s <= weekEnd ? "week" : p.year === year && p.month === month ? "month" : "later";
      buckets[b].push(e);
    }
    return (Object.keys(buckets) as Bucket[])
      .filter((b) => buckets[b].length > 0)
      .map((b) => ({ key: b, title: LABEL[b], count: buckets[b].length, data: closed.has(b) ? [] : buckets[b] }));
  }, [data, today, closed]);

  const total = sections.reduce((n, s) => n + s.count, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="일정 요약" subtitle={group ? `${group.name} · 이후 일정 총 ${total}건` : undefined} />
      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
      {loading ? (
        <Loading />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e) => e.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
          ListEmptyComponent={<Empty title="다가오는 일정이 없어요" body="아래로 당기면 새로고침돼요." />}
          renderSectionHeader={({ section }) => {
            const open = !closed.has(section.key as Bucket);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${section.title}, 일정 ${section.count}개`}
                accessibilityState={{ expanded: open }}
                onPress={() => {
                  // Rows slide/fade in as the section opens (220ms) and out faster as it closes (180ms).
                  if (!prefersReducedMotion()) {
                    const ms = open ? DUR.close : DUR.open;
                    LayoutAnimation.configureNext({
                      duration: ms,
                      create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity, duration: ms },
                      update: { type: LayoutAnimation.Types.easeOut, duration: ms },
                      delete: { type: LayoutAnimation.Types.easeIn, property: LayoutAnimation.Properties.opacity, duration: Math.round(ms * 0.6) },
                    });
                  }
                  const next = new Set(closed);
                  if (open) next.add(section.key as Bucket);
                  else next.delete(section.key as Bucket);
                  setClosed(next);
                }}
                style={{
                  marginTop: 16,
                  minHeight: 56,
                  paddingHorizontal: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: c.card,
                  borderTopLeftRadius: radius.card,
                  borderTopRightRadius: radius.card,
                  borderBottomLeftRadius: open ? 0 : radius.card,
                  borderBottomRightRadius: open ? 0 : radius.card,
                }}
              >
                <T variant="headline">{section.title}</T>
                <Tag label={String(section.count)} bg={c.primaryContainer} fg={c.onPrimaryContainer} />
                <View style={{ flex: 1 }} />
                <Chevron open={open} color={c.text2} />
              </Pressable>
            );
          }}
          renderItem={({ item: e, index, section }) => {
            const s = toKey(e.startDate) < today ? today : toKey(e.startDate);
            const p = parseKey(s);
            const persons = splitList(e.personnel);
            const multi = toKey(e.startDate) !== toKey(e.endDate);
            const sub = [multi ? `${dotted(toKey(e.startDate))} – ${dotted(toKey(e.endDate))}` : null, e.equipmentOnly ? e.equipment : persons.join(", ")].filter(Boolean).join(" · ");
            const last = index === section.data.length - 1;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${longLabel(s)}, ${e.title}${e.equipmentOnly ? ", 장비 반출" : ""}${sub ? `, ${sub}` : ""}`}
                onPress={() => router.push({ pathname: "/day/[date]", params: { date: s } })}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  minHeight: 68,
                  backgroundColor: pressed ? c.subtle : c.card,
                  borderTopWidth: 1,
                  borderTopColor: c.outline,
                  borderBottomLeftRadius: last ? radius.card : 0,
                  borderBottomRightRadius: last ? radius.card : 0,
                })}
              >
                <View style={{ width: 44, alignItems: "center" }}>
                  <T variant="title2" style={{ fontSize: 20, lineHeight: 24 }}>
                    {p.day}
                  </T>
                  <T variant="footnote" color={c.text2} style={{ fontSize: 12 }}>
                    {section.key === "later" ? `${p.month}월` : WEEKDAYS[weekday(s)]}
                  </T>
                </View>
                <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: e.color }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <T variant="subhead" numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>
                      {e.category === "ATTENDANCE" ? `${e.title}` : e.title}
                    </T>
                    {e.equipmentOnly ? <Tag label="장비 반출" bg={c.infoContainer} fg={c.onInfo} /> : null}
                  </View>
                  {sub ? (
                    <T variant="caption" color={c.text2} numberOfLines={1} style={{ fontWeight: "400" }}>
                      {sub}
                    </T>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

/** Section chevron: turns with the section instead of flipping. */
function Chevron({ open, color }: { open: boolean; color: string }) {
  const [v] = useState(() => new Animated.Value(open ? 1 : 0));
  useEffect(() => {
    timeTo(v, open ? 1 : 0, open ? DUR.open : DUR.close, EASE_OUT);
  }, [v, open]);
  return (
    <Animated.View style={{ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
      <Icon name="down" size={20} color={color} />
    </Animated.View>
  );
}
