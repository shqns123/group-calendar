import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { PixelRatio, Pressable, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { ErrorBanner, IconButton, T } from "@/components/ui";
import { api } from "@/lib/api";
import { chipsFor } from "@/lib/calendar";
import { keyToIso, longLabel, monthGrid, monthLabel, parseKey, shiftMonth, todayKey, WEEKDAYS, weekday } from "@/lib/date";
import { pickGroup } from "@/lib/pickGroup";
import { useSession } from "@/lib/session";
import type { CalEvent } from "@/lib/types";
import { useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { eventWash, HIT, type } from "@/theme/tokens";

export default function CalendarScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { group, groups, selectGroup } = useSession();
  const today = todayKey();
  const [ym, setYm] = useState(() => ({ year: parseKey(today).year, month: parseKey(today).month }));
  const [gridH, setGridH] = useState(0);

  const cells = useMemo(() => monthGrid(ym.year, ym.month), [ym]);
  const first = cells[0].key;
  const last = cells[cells.length - 1].key;

  const { data: events, error, refresh } = useData(group ? `events:${group.id}:${first}` : null, () =>
    api<CalEvent[]>("/api/events", { query: { groupId: group!.id, start: keyToIso(first), end: keyToIso(last) } }),
  );

  // How many chips fit: derived from the measured cell height and the OS text size.
  const rows = cells.length / 7;
  const cellH = gridH > 0 ? gridH / rows : 0;
  const fontScale = PixelRatio.getFontScale();
  const chipH = Math.ceil((type.caption.lineHeight + 4) * fontScale) + 2;
  const numH = Math.ceil(24 * fontScale) + 6;
  const fit = cellH > 0 ? Math.max(0, Math.floor((cellH - numH - chipH) / chipH)) : 0;

  const prev = shiftMonth(ym.year, ym.month, -1);
  const next = shiftMonth(ym.year, ym.month, 1);

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 8, paddingBottom: 6, gap: 4, borderBottomWidth: 1, borderBottomColor: c.outline }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`그룹 전환, 현재 ${group?.name ?? "그룹 없음"}`}
            onPress={() => pickGroup(groups, group?.id ?? null, selectGroup)}
            style={{ minHeight: HIT, justifyContent: "center" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, minHeight: 32, borderRadius: 999, backgroundColor: c.primaryContainer }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
              <T variant="footnote" color={c.onPrimaryContainer}>
                {group?.name ?? "그룹 없음"}
              </T>
              {groups.length > 1 ? <Icon name="down" size={16} color={c.onPrimaryContainer} /> : null}
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setYm({ year: parseKey(today).year, month: parseKey(today).month })}
            style={{ minHeight: HIT, minWidth: HIT, paddingHorizontal: 12, justifyContent: "center" }}
          >
            <T variant="subhead" style={{ fontWeight: "600" }} color={c.primaryText}>
              오늘
            </T>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <IconButton icon="back" label={`이전 달, ${monthLabel(prev.year, prev.month)}`} onPress={() => setYm(prev)} />
          <T variant="title1" accessibilityRole="header">
            {monthLabel(ym.year, ym.month)}
          </T>
          <IconButton icon="forward" label={`다음 달, ${monthLabel(next.year, next.month)}`} onPress={() => setYm(next)} />
        </View>
      </View>

      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: "row", paddingHorizontal: 4, paddingTop: 6, paddingBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <T key={w} variant="footnote" style={{ flex: 1, textAlign: "center", fontSize: 12 }} color={i === 0 ? c.sunday : i === 6 ? c.saturday : c.text2}>
            {w}
          </T>
        ))}
      </View>

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
      {!group ? <ErrorBanner message="속한 그룹이 없어요. 웹에서 초대 링크로 그룹에 가입해 주세요." /> : null}

      <View style={{ flex: 1, paddingHorizontal: 4, paddingBottom: 4 }} onLayout={(e: LayoutChangeEvent) => setGridH(e.nativeEvent.layout.height - 4)}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={{ flex: 1, flexDirection: "row" }}>
            {cells.slice(r * 7, r * 7 + 7).map(({ key, inMonth }) => {
              const chips = events ? chipsFor(events, key) : [];
              const shown = chips.slice(0, chips.length > fit ? Math.max(0, fit - 1) : fit);
              const more = chips.length - shown.length;
              const col = weekday(key);
              const isToday = key === today;
              const numColor = isToday ? c.onPrimary : !inMonth ? c.muted : col === 0 ? c.sunday : col === 6 ? c.saturday : c.text;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`${longLabel(key)}${inMonth ? "" : ", 다른 달"}, ${chips.length ? `일정 ${chips.length}개` : "일정 없음"}${isToday ? ", 오늘" : ""}`}
                  accessibilityState={{ selected: isToday }}
                  onPress={() => router.push({ pathname: "/day/[date]", params: { date: key } })}
                  style={({ pressed }) => ({
                    flex: 1,
                    overflow: "hidden",
                    paddingVertical: 4,
                    paddingHorizontal: 2,
                    gap: 2,
                    borderTopWidth: 1,
                    borderTopColor: c.subtle,
                    borderRadius: 10,
                    backgroundColor: pressed ? c.primaryContainer : "transparent",
                  })}
                >
                  <View style={{ alignSelf: "center", minWidth: 24, height: 24 * fontScale, paddingHorizontal: 4, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: isToday ? c.primary : "transparent" }}>
                    <T variant="footnote" color={numColor}>
                      {parseKey(key).day}
                    </T>
                  </View>
                  {shown.map((chip) => (
                    <View key={chip.key} style={{ borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: eventWash(chip.color, c) }}>
                      <T variant="caption" numberOfLines={1} ellipsizeMode="clip">
                        {chip.label}
                      </T>
                    </View>
                  ))}
                  {more > 0 ? (
                    <T variant="caption" color={c.text2} style={{ textAlign: "center" }}>
                      +{more}
                    </T>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="일정 추가"
        onPress={() => router.push({ pathname: "/event/edit", params: { date: today } })}
        style={{ position: "absolute", right: 12, bottom: 12, width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
      >
        {({ pressed }) => (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: c.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              shadowColor: "#0F172A",
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <Icon name="add" size={24} color={c.onPrimary} />
          </View>
        )}
      </Pressable>
    </View>
  );
}
