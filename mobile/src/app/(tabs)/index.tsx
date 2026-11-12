import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder, PixelRatio, Platform, Pressable, ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { MiniButton } from "@/components/list";
import { ErrorBanner, IconButton, T } from "@/components/ui";
import { api } from "@/lib/api";
import { dayMarks, eventsOn, isElevated, layoutWeek } from "@/lib/calendar";
import { dotted, keyToIso, longLabel, monthGrid, monthLabel, parseKey, shiftMonth, todayKey, toKey, WEEKDAYS, WEEKDAYS_LONG, weekday, type DateKey } from "@/lib/date";
import { splitList } from "@/lib/roster";
import { useSession } from "@/lib/session";
import type { CalEvent } from "@/lib/types";
import { useData } from "@/lib/useData";
import { useMonthPager } from "@/lib/useMonthPager";
import { holidayInfo } from "@/lib/holidays";
import { permissionsFor } from "@/lib/permissions";
import { useHolidays } from "@/lib/useHolidays";
import { useTheme } from "@/theme/ThemeProvider";
import { useWide, useWideDay } from "@/lib/wide";
import { DayDetail } from "../day/[date]";
import { radius, type } from "@/theme/tokens";

// Event bars use the web calendar's style on purpose (CalendarView eventContent + globals.css .fc-event):
// event color at 0x28 alpha behind event-colored text, 0.62rem (≈10px) / 600, 4px corners.
// This is a documented exception to DESIGN.md's 12px floor and ink-text rule.
const BAR = { washAlpha: "28", fontSize: 10, lineHeight: 12.5, radius: 4 } as const;
// Day cells (canvas): faint gray base; days with events take a lighter wash of the top bar color.
const CELL = { alpha: { light: "12", dark: "1C" }, base: { light: "#F9F9FB", dark: "#1E232A" } } as const;
// Split view (swipe up): the month shrinks, bars become thin lines, and the selected day's list shows below.
const COMPACT = { line: 4, gap: 2, lanes: 3 } as const;

/**
 * Calendar tab. Phones: the month (date taps open the day popup). Unfolded / wide screens:
 * the month sits in the left pane (see the tabs layout), so this tab shows the picked day's
 * detail in the right pane instead.
 */
export default function CalendarScreen() {
  const wide = useWide();
  const { date, setDate } = useWideDay();
  if (wide) return <DayDetail inline date={date ?? todayKey()} onChangeDate={setDate} />;
  return <CalendarView />;
}

/** The month view. `pane`: left half of the wide layout — date taps fill the right pane. */
export function CalendarView({ pane }: { pane?: boolean }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { group, me } = useSession();
  const elevated = isElevated(group, me);
  const holidays = useHolidays();
  const perms = permissionsFor(group, me);
  const today = todayKey();
  const [ym, setYm] = useState(() => ({ year: parseKey(today).year, month: parseKey(today).month }));
  const [gridH, setGridH] = useState(0);
  const [split, setSplit] = useState(false);
  const [pickedLocal, setPickedLocal] = useState<DateKey | null>(null);
  const wideDay = useWideDay();
  // In the wide layout the picked day is shared with the right pane.
  const picked = pane ? wideDay.date : pickedLocal;
  const setPicked = pane ? wideDay.setDate : setPickedLocal;
  const [progress] = useState(() => new Animated.Value(0));
  const [areaH, setAreaH] = useState(0);

  const cells = useMemo(() => monthGrid(ym.year, ym.month), [ym]);
  const first = cells[0].key;
  const last = cells[cells.length - 1].key;

  const { data: events } = useData(group ? `events:${group.id}:${first}` : null, () =>
    api<CalEvent[]>("/api/events", { query: { groupId: group!.id, start: keyToIso(first), end: keyToIso(last) } }),
  );

  // How many bar lanes fit: measured row height and OS text size, capped by the
  // group's display limit (same setting the web uses, default 3).
  const rows = cells.length / 7;
  const rowH = gridH > 0 ? gridH / rows : 0;
  const fontScale = PixelRatio.getFontScale();
  const barH = Math.ceil((BAR.lineHeight + 4) * fontScale);
  const laneGap = 2;
  const numH = 4 + Math.ceil(24 * fontScale) + 2;
  // Bottom of the cell keeps room for "+N" and the status dots.
  const moreH = Math.ceil(type.caption.lineHeight * fontScale) + 14;
  const fit = rowH > 0 ? Math.max(0, Math.floor((rowH - numH - moreH) / (barH + laneGap))) : 0;
  const maxLanes = Math.min(fit, Math.max(1, Math.min(10, group?.eventDisplayLimit ?? 3)));

  const prev = shiftMonth(ym.year, ym.month, -1);
  const next = shiftMonth(ym.year, ym.month, 1);
  // 0 = full month, 1 = shrunken month with the day list. Height is animated on the JS
  // driver (layout props can't use the native driver); the list fades in as it grows.
  const changeSplit = (on: boolean) => {
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (on) setSplit(true);
        const done = () => {
          if (!on) setSplit(false);
        };
        if (reduce) {
          progress.setValue(on ? 1 : 0);
          done();
          return;
        }
        Animated.timing(progress, { toValue: on ? 1 : 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
          if (finished) done();
        });
      });
  };
  const pager = useMonthPager(
    (delta) => {
      setPicked(null);
      setYm((cur) => shiftMonth(cur.year, cur.month, delta));
    },
    (dir) => changeSplit(dir < 0),
  );
  // Selected day (first tap selects, second tap opens the day sheet): what was tapped, else today in this month, else the 1st.
  const monthStart = cells.find((x) => x.inMonth)!.key;
  const sel = picked && cells.some((x) => x.key === picked) ? picked : cells.some((x) => x.key === today && x.inMonth) ? today : monthStart;
  const compactLanes = Math.min(COMPACT.lanes, Math.max(1, group?.eventDisplayLimit ?? 3));
  const compactRowH = numH + compactLanes * (COMPACT.line + COMPACT.gap) + 10;
  // Drag the list's handle down to bring the full month back.
  const [handlePan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 24 || g.vy > 0.3) changeSplit(false);
      },
    }),
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={{ paddingTop: insets.top + 6, paddingLeft: 20, paddingRight: 12, paddingBottom: 8, gap: 2 }}>
        {/* Canvas: no top row (group switch and 오늘 live elsewhere) — just ‹ 11월 ›. */}
        {/* Layout from the design canvas: ‹  2026년 11월  › with the month centered between the arrows. */}
        <View style={{ flexDirection: "row", alignItems: "center", marginLeft: -12, marginRight: -4 }}>
          <IconButton tone="plain" icon="back" label={`이전 달, ${monthLabel(prev.year, prev.month)}`} onPress={() => pager.go(-1)} />
          <T variant="title1" accessibilityRole="header" accessibilityLabel={monthLabel(ym.year, ym.month)} style={{ flex: 1, textAlign: "center" }}>
            {`${ym.month}월`}
          </T>
          <IconButton tone="plain" icon="forward" label={`다음 달, ${monthLabel(next.year, next.month)}`} onPress={() => pager.go(1)} />
        </View>
      </View>

      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: "row", paddingHorizontal: 4, paddingTop: 6, paddingBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <T key={w} variant="footnote" style={{ flex: 1, textAlign: "center", fontSize: 12 }} color={i === 0 ? c.sunday : i === 6 ? c.saturday : c.text2}>
            {w}
          </T>
        ))}
      </View>

      {!group ? <ErrorBanner message="속한 그룹이 없어요. 웹에서 초대 링크로 그룹에 가입해 주세요." /> : null}

      <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setAreaH(e.nativeEvent.layout.height)}>
      <Animated.View
        {...pager.panHandlers}
        accessibilityActions={[{ name: "toggleList", label: split ? "일정 목록 닫기" : "선택한 날 일정 목록 보기" }]}
        onAccessibilityAction={() => changeSplit(!split)}
        style={
          split && areaH > 0
            ? { height: progress.interpolate({ inputRange: [0, 1], outputRange: [areaH, Math.min(areaH, rows * compactRowH + 4)] }), overflow: "hidden" }
            : { flex: 1, overflow: "hidden" }
        }
        onLayout={(e: LayoutChangeEvent) => {
          // Lane fitting uses the full-size grid only; split mode has its own fixed lanes.
          if (!split) setGridH(e.nativeEvent.layout.height - 4);
          pager.setWidth(e.nativeEvent.layout.width);
        }}
      >
      <Animated.View style={{ flex: 1, paddingHorizontal: 4, paddingBottom: 4, transform: [{ translateX: pager.slide }] }}>
        {Array.from({ length: rows }, (_, r) => {
          const week = cells.slice(r * 7, r * 7 + 7);
          const layout = layoutWeek(events ?? [], week.map((w) => w.key), split ? compactLanes : maxLanes);
          return (
            <View key={r} style={{ flex: 1, flexDirection: "row" }}>
              {week.map(({ key, inMonth }, col) => {
                const marks = events ? dayMarks(events, key, me, elevated) : { attendance: false, overtime: false };
                const bars = layout.total[col];
                const more = layout.hidden[col];
                const wd = weekday(key);
                const isToday = key === today;
                const isSel = key === sel;
                const hol = holidayInfo(key, holidays);
                const tint = layout.cellTint[col];
                // Gray base always; a day with events lays a light wash of its top bar color over it.
                const base = isDark ? CELL.base.dark : CELL.base.light;
                const wash = tint.color && /^#[0-9a-f]{6}$/i.test(tint.color) ? `${tint.color}${isDark ? CELL.alpha.dark : CELL.alpha.light}` : null;
                const numColor = isToday
                  ? c.onPrimary
                  : !inMonth
                    ? c.muted
                    : hol.holiday || (wd === 0 && !hol.workday)
                      ? c.sunday
                      : wd === 6 && !hol.workday
                        ? c.saturday
                        : c.text;
                const label = [
                  `${longLabel(key)}${inMonth ? "" : ", 다른 달"}`,
                  hol.name ? (hol.workday ? `${hol.name}(근무일)` : hol.name) : null,
                  bars ? `일정 ${bars}개` : "일정 없음",
                  marks.attendance ? "근태 있음" : null,
                  marks.overtime ? "특근 가능 표시" : null,
                  isToday ? "오늘" : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isSel }}
                    accessibilityHint={isSel || (!split && bars > 0) ? "상세 보기" : "날짜 선택"}
                    onPress={() => {
                      // Wide layout: any tap shows that day in the right pane (and returns to the calendar tab).
                      if (pane) {
                        setPicked(key);
                        router.navigate("/");
                        return;
                      }
                      // A day with events opens its popup on the first tap (month view);
                      // an empty day — or any day while the list is open — is selected first.
                      if (isSel || (!split && bars > 0)) {
                        setPicked(key);
                        router.push({ pathname: "/day/[date]", params: { date: key } });
                      } else setPicked(key);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      overflow: "hidden",
                      paddingTop: 4,
                      paddingBottom: 4,
                      // A multi-day top bar joins its cells into one block (square inner corners).
                      borderTopLeftRadius: tint.joinPrev ? 0 : 10,
                      borderBottomLeftRadius: tint.joinPrev ? 0 : 10,
                      borderTopRightRadius: tint.joinNext ? 0 : 10,
                      borderBottomRightRadius: tint.joinNext ? 0 : 10,
                      // 1px gap between day cells, except inside a multi-day block (Samsung Calendar joins them).
                      marginVertical: 0.5,
                      marginLeft: tint.joinPrev ? 0 : 0.5,
                      marginRight: tint.joinNext ? 0 : 0.5,
                      // Today's cell keeps the plain background (its number circle already marks it).
                      backgroundColor: (pressed || isSel) && !isToday ? c.primaryContainer : base,
                    })}
                  >
                    {wash && (!isSel || isToday) ? <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: wash }} /> : null}
                    <View style={{ alignSelf: "center", minWidth: 24, height: 24 * fontScale, paddingHorizontal: 4, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: isToday ? c.primary : "transparent" }}>
                      <T variant="footnote" color={numColor}>
                        {parseKey(key).day}
                      </T>
                    </View>
                    <View style={{ flex: 1 }} />
                    {more > 0 && !split ? (
                      <T variant="caption" color={c.text2} style={{ textAlign: "center" }}>
                        +{more}
                      </T>
                    ) : null}
                    {/* Web calendar marks: blue dot = attendance, red dot = overtime (blue sits left of red). */}
                    {marks.attendance ? <Dot color={c.saturday} right={marks.overtime ? 14 : 4} /> : null}
                    {marks.overtime ? <Dot color={c.sunday} right={4} /> : null}
                  </Pressable>
                );
              })}

              {/* Event bars span their days within the week; taps fall through to the day cells. */}
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: numH, bottom: 0 }}>
                {layout.segments.map((s) =>
                  split ? (
                    <View
                      key={`${s.id}-${r}`}
                      style={{
                        position: "absolute",
                        top: s.lane * (COMPACT.line + COMPACT.gap),
                        height: COMPACT.line,
                        left: `${(s.startCol / 7) * 100}%`,
                        width: `${(s.span / 7) * 100}%`,
                        paddingLeft: s.roundStart ? 4 : 0,
                        paddingRight: s.roundEnd ? 4 : 0,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: s.color,
                          borderTopLeftRadius: s.roundStart ? 2 : 0,
                          borderBottomLeftRadius: s.roundStart ? 2 : 0,
                          borderTopRightRadius: s.roundEnd ? 2 : 0,
                          borderBottomRightRadius: s.roundEnd ? 2 : 0,
                        }}
                      />
                    </View>
                  ) : (
                  <View
                    key={`${s.id}-${r}`}
                    style={{
                      position: "absolute",
                      top: s.lane * (barH + laneGap),
                      height: barH,
                      left: `${(s.startCol / 7) * 100}%`,
                      width: `${(s.span / 7) * 100}%`,
                      paddingLeft: s.roundStart ? 2 : 0,
                      paddingRight: s.roundEnd ? 2 : 0,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        paddingHorizontal: 4,
                        backgroundColor: `${s.color}${BAR.washAlpha}`,
                        borderTopLeftRadius: s.roundStart ? BAR.radius : 0,
                        borderBottomLeftRadius: s.roundStart ? BAR.radius : 0,
                        borderTopRightRadius: s.roundEnd ? BAR.radius : 0,
                        borderBottomRightRadius: s.roundEnd ? BAR.radius : 0,
                      }}
                    >
                      <T
                        variant="caption"
                        color={s.color}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{ textAlign: "center", fontSize: BAR.fontSize, lineHeight: BAR.lineHeight, fontWeight: "600" }}
                      >
                        {s.title}
                      </T>
                    </View>
                  </View>
                  ),
                )}
              </View>
            </View>
          );
        })}
      </Animated.View>
      </Animated.View>

      {split ? (
        <Animated.View style={{ flex: 1, opacity: progress }}>
        <DayList
          date={sel}
          events={events ? eventsOn(events, sel).filter((e) => !e.isOvertimeOnly) : null}
          holiday={holidayInfo(sel, holidays).name}
          handlers={handlePan.panHandlers}
          onClose={() => changeSplit(false)}
          onOpenDay={() => router.push({ pathname: "/day/[date]", params: { date: sel } })}
          onOpenEvent={perms.canWriteEvents ? (id) => router.push({ pathname: "/event/edit", params: { id, date: sel } }) : undefined}
        />
        </Animated.View>
      ) : null}
      </View>

      {perms.canWriteEvents ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="일정 추가"
        onPress={() => router.push({ pathname: "/event/edit", params: { date: sel } })}
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
      ) : null}
    </View>
  );
}

/** Status dot in the bottom-right corner of a day cell (web: .fc-day-attendance / .fc-day-overtime). */
function Dot({ color, right }: { color: string; right: number }) {
  return <View style={{ position: "absolute", bottom: 4, right, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />;
}

/** Selected day's events under the shrunken month (split view). */
function DayList({
  date,
  events,
  holiday,
  handlers,
  onClose,
  onOpenDay,
  onOpenEvent,
}: {
  date: DateKey;
  events: CalEvent[] | null;
  holiday: string | null | undefined;
  handlers: ReturnType<typeof PanResponder.create>["panHandlers"];
  onClose: () => void;
  onOpenDay: () => void;
  onOpenEvent?: (id: string) => void;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  // Picking another day slides the list in from the side the date lies on:
  // a later day comes in from the right (moves left), an earlier one from the left.
  const [slide] = useState(() => new Animated.Value(0));
  const shown = useRef(date);
  useEffect(() => {
    if (shown.current === date) return;
    const dir = date > shown.current ? 1 : -1;
    shown.current = date;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive || reduce) return;
        slide.setValue(dir * width);
        Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
      });
    return () => {
      alive = false;
    };
  }, [date, slide, width]);
  const opacity = slide.interpolate({ inputRange: [-width, 0, width], outputRange: [0, 1, 0] });
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, overflow: "hidden" }}>
      <View {...handlers}>
        <Pressable accessibilityRole="button" accessibilityLabel="일정 목록 닫기" onPress={onClose} style={{ height: 24, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: c.handle }} />
        </Pressable>
      </View>
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateX: slide }] }}>
      <View {...handlers}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 12, paddingBottom: 8, gap: 8 }}>
          <T variant="title2" accessibilityRole="header" accessibilityLabel={longLabel(date)}>
            {parseKey(date).day}
          </T>
          <T variant="subhead" style={{ flex: 1, fontWeight: "600" }} color={holiday ? c.sunday : c.text2} numberOfLines={1}>
            {[WEEKDAYS_LONG[weekday(date)], holiday].filter(Boolean).join(" · ")}
          </T>
          <MiniButton tone="neutral" label="자세히" onPress={onOpenDay} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80, gap: 8 }}>
        {events && events.length === 0 ? (
          <T variant="subhead" color={c.muted} style={{ paddingHorizontal: 4, paddingVertical: 12 }}>
            이 날은 일정이 없어요.
          </T>
        ) : null}
        {(events ?? []).map((e) => {
          const s = toKey(e.startDate);
          const t = toKey(e.endDate);
          const people = splitList(e.personnel);
          const sub = [s === t ? null : `${dotted(s)} – ${dotted(t)}`, e.category === "ATTENDANCE" ? "근태" : e.equipmentOnly ? "장비 반출" : null, people.join(", ") || null]
            .filter(Boolean)
            .join(" · ");
          return (
            <Pressable
              key={e.id}
              accessibilityRole={onOpenEvent ? "button" : undefined}
              accessibilityLabel={`${e.title}${sub ? `, ${sub}` : ""}${onOpenEvent ? ", 수정하기" : ""}`}
              onPress={onOpenEvent ? () => onOpenEvent(e.id) : undefined}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 60,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: radius.control,
                backgroundColor: pressed && onOpenEvent ? c.fill : c.card,
              })}
            >
              <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: e.color }} />
              <View style={{ flex: 1, gap: 2 }}>
                {/* Canvas (1b): title 15/600, sub-line 12/600. */}
                <T variant="subhead" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, fontWeight: "600" }}>
                  {e.title}
                </T>
                {sub ? (
                  <T variant="caption" color={c.text2} numberOfLines={1} style={{ fontSize: 12, fontWeight: "600" }}>
                    {sub}
                  </T>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      </Animated.View>
    </View>
  );
}
