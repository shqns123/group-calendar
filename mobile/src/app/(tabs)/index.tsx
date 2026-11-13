import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder, PixelRatio, Platform, Pressable, ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MiniButton } from "@/components/list";
import { DismissLayer } from "@/components/DismissLayer";
import { QuickAddBar } from "@/components/QuickAddBar";
import { DUR, EASE_OUT, timeTo } from "@/lib/motion";
import { ErrorBanner, IconButton, T } from "@/components/ui";
import { api } from "@/lib/api";
import { dayMarks, eventsOn, isElevated, layoutWeek } from "@/lib/calendar";
import { dotted, keyToIso, longLabel, monthGrid, monthLabel, parseKey, shiftMonth, todayKey, toKey, WEEKDAYS, WEEKDAYS_LONG, weekday, type DateKey } from "@/lib/date";
import { splitList } from "@/lib/roster";
import { useSession } from "@/lib/session";
import type { CalEvent, CustomHoliday, Me } from "@/lib/types";
import { useData } from "@/lib/useData";
import { STRIP_SPAN, useMonthPager } from "@/lib/useMonthPager";
import { holidayInfo } from "@/lib/holidays";
import { permissionsFor } from "@/lib/permissions";
import { useHolidays } from "@/lib/useHolidays";
import { useTheme } from "@/theme/ThemeProvider";
import { rememberedMonth, rememberMonth, useSplit, useWide, useWideDay, useWideMode } from "@/lib/wide";
import Feather from "@expo/vector-icons/Feather";
import { DayDetail } from "../day/[date]";
import { radius } from "@/theme/tokens";

// Event bars use the web calendar's style on purpose (CalendarView eventContent + globals.css .fc-event):
// event color at 0x28 alpha behind event-colored text, 0.62rem (≈10px) / 600, 4px corners.
// This is a documented exception to DESIGN.md's 12px floor and ink-text rule.
const BAR = { washAlpha: "28", fontSize: 10, lineHeight: 12.5, radius: 4 } as const;
// Other-month days: page-color wash on top (hex alpha ≈ 64%) — numbers end up ~⅓ strength, like One UI.
const OTHER_MONTH_FADE = "A3";
// "+N" under the bars when a day has more than fit.
const MORE = { fontSize: 11, lineHeight: 14 } as const;
// Day cells (canvas): faint gray base; days with events take a lighter wash of the top bar color.
const CELL = { alpha: { light: "0B", dark: "14" }, base: { light: "#FBFBFC", dark: "#1D2229" } } as const;
// Split view (swipe up): the month shrinks, bars become thin lines, and the selected day's list shows below.
const COMPACT = { line: 4, gap: 2, lanes: 3 } as const;

/**
 * Calendar tab. Phones: the month (date taps open the day popup). Unfolded / wide screens:
 * the month sits in the left pane (see the tabs layout), so this tab shows the picked day's
 * detail in the right pane instead.
 */
export default function CalendarScreen() {
  // Split (wide screen, two panes): the calendar is the left pane, so this tab is the day detail.
  // Full screen (and phones): this tab is the calendar itself.
  const split = useSplit();
  const { date, setDate } = useWideDay();
  if (split) return <DayDetail inline date={date ?? todayKey()} onChangeDate={setDate} />;
  return <CalendarView />;
}

/** The month view. `pane`: left half of the wide layout — date taps fill the right pane. */
export function CalendarView({ pane }: { pane?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { group, me } = useSession();
  const elevated = isElevated(group, me);
  const holidays = useHolidays();
  const perms = permissionsFor(group, me);
  // Quick-add typing mode: a tap anywhere else on the screen just ends it.
  const [typing, setTyping] = useState(false);
  const today = todayKey();
  // Start on the month that was on screen (switching 분할 ↔ 전체화면 mounts a new calendar view).
  const [ym, setYm] = useState(() => rememberedMonth() ?? { year: parseKey(today).year, month: parseKey(today).month });
  useEffect(() => {
    rememberMonth(ym);
  }, [ym]);
  const wide = useWide();
  const { full, toggleFull } = useWideMode();
  const [gridH, setGridH] = useState(0);
  const [split, setSplit] = useState(false);
  const [pickedLocal, setPickedLocal] = useState<DateKey | null>(null);
  const wideDay = useWideDay();
  // In the wide layout the picked day is shared with the right pane.
  const picked = pane ? wideDay.date : pickedLocal;
  const setPicked = pane ? wideDay.setDate : setPickedLocal;
  const [progress] = useState(() => new Animated.Value(0));
  const [areaH, setAreaH] = useState(0);

  const index = ym.year * 12 + ym.month - 1;
  const cells = useMemo(() => monthGrid(ym.year, ym.month), [ym]);
  const first = cells[0].key;
  const last = cells[cells.length - 1].key;

  // Same key as the current MonthPage, so this is served from the cache (used by the day list).
  const { data: events } = useData(group ? `events:${group.id}:${first}` : null, () =>
    api<CalEvent[]>("/api/events", { query: { groupId: group!.id, start: keyToIso(first), end: keyToIso(last) } }),
  );

  const rows = cells.length / 7;
  const { numH } = cellMetrics(PixelRatio.getFontScale());
  const limit = Math.max(1, Math.min(10, group?.eventDisplayLimit ?? 3));

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
    index,
    (delta) => {
      setPicked(null);
      setYm((cur) => shiftMonth(cur.year, cur.month, delta));
    },
    (dir) => changeSplit(dir < 0),
  );
  // Selected day (first tap selects, second tap opens the day sheet): what was tapped, else today in this month, else the 1st.
  const sel = picked && cells.some((x) => x.key === picked) ? picked : defaultSel(cells, today);
  const compactLanes = Math.min(COMPACT.lanes, limit);
  const compactRowH = numH + compactLanes * (COMPACT.line + COMPACT.gap) + 10;
  // Day taps (current page). Kept in a ref so the pages' prop stays stable and they don't re-render on every tap.
  const pressRef = useRef<(key: DateKey, isSel: boolean, bars: number) => void>(() => {});
  useEffect(() => {
    pressRef.current = (key, isSel, bars) => {
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
    };
  });
  const onPressDay = useCallback((key: DateKey, isSel: boolean, bars: number) => pressRef.current(key, isSel, bars), []);
  const pageProps = { groupId: group?.id ?? null, today, split, gridH, limit, me, elevated, holidays, onPressDay };
  const W = pager.width;
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
          {/* Wide screens: 분할 ↔ 전체화면. */}
          {wide ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={full ? "분할 화면으로 보기" : "캘린더 전체 화면으로 보기"}
              onPress={toggleFull}
              hitSlop={4}
              style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.fill : "transparent" })}
            >
              <Feather name={full ? "columns" : "maximize-2"} size={20} color={c.text2} />
            </Pressable>
          ) : null}
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
      {W > 0 ? (
        // One strip, pages placed by absolute month index: the drag and the fling move all three
        // together, and a month change only adds a new neighbor off screen (nothing jumps).
        <Animated.View
          style={{ position: "absolute", top: 0, bottom: 0, left: -STRIP_SPAN * W, width: (STRIP_SPAN * 2 + 1) * W, transform: [{ translateX: pager.slide }] }}
        >
          {[-1, 0, 1].map((d) => {
            const m = shiftMonth(ym.year, ym.month, d);
            const mi = index + d;
            return (
              <View
                key={mi}
                importantForAccessibility={d === 0 ? "auto" : "no-hide-descendants"}
                accessibilityElementsHidden={d !== 0}
                style={{ position: "absolute", top: 0, bottom: 0, width: W, left: (mi - pager.base + STRIP_SPAN) * W, paddingHorizontal: 4, paddingBottom: 4 }}
              >
                <MonthPage year={m.year} month={m.month} sel={d === 0 ? sel : null} {...pageProps} />
              </View>
            );
          })}
        </Animated.View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 4, paddingBottom: 4 }}>
          <MonthPage year={ym.year} month={ym.month} sel={sel} {...pageProps} />
        </View>
      )}
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

      {/* Samsung-style one-line quick add under the month (replaces the + button). */}
      {typing ? <DismissLayer /> : null}
      {perms.canWriteEvents && group ? (
        // A short pill centered under the month (One UI: about two thirds of the width);
        // typing opens it into a card almost as wide as the screen.
        <View style={{ paddingHorizontal: 48, paddingTop: 6, paddingBottom: 10 }}>
          <QuickAddBar date={sel} widen={40} onActiveChange={setTyping} />
        </View>
      ) : null}
    </View>
  );
}

/** Bar / cell sizes for the OS text size. */
function cellMetrics(fontScale: number) {
  return {
    fontScale,
    barH: Math.ceil((BAR.lineHeight + 3) * fontScale),
    laneGap: 2,
    numH: 4 + Math.ceil(24 * fontScale) + 2,
    // Bottom strip of the cell for "+N" and the status dots (they share it: +N centered, dots right),
    // plus the cell's bottom padding.
    moreH: Math.ceil(MORE.lineHeight * fontScale) + 6,
  };
}

/** Today if it's in this month, else the 1st. */
function defaultSel(cells: { key: DateKey; inMonth: boolean }[], today: DateKey) {
  return cells.some((x) => x.key === today && x.inMonth) ? today : cells.find((x) => x.inMonth)!.key;
}

type MonthPageProps = {
  year: number;
  month: number;
  /** Current page: the selected day. Neighbors: null (they show the default they'll have once current). */
  sel: DateKey | null;
  groupId: string | null;
  today: DateKey;
  split: boolean;
  gridH: number;
  limit: number;
  me: Me | null;
  elevated: boolean;
  holidays: CustomHoliday[];
  onPressDay: (key: DateKey, isSel: boolean, bars: number) => void;
};

/**
 * One month's grid. Each page loads its own month (so the neighbors are already there when you
 * swipe) and is memoized, so a page only re-renders when its own inputs change.
 */
const MonthPage = memo(function MonthPage({ year, month, sel: selProp, groupId, today, split, gridH, limit, me, elevated, holidays, onPressDay }: MonthPageProps) {
  const { c, isDark } = useTheme();
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const first = cells[0].key;
  const last = cells[cells.length - 1].key;
  const { data: events } = useData(groupId ? `events:${groupId}:${first}` : null, () =>
    api<CalEvent[]>("/api/events", { query: { groupId: groupId!, start: keyToIso(first), end: keyToIso(last) } }),
  );
  const sel = selProp ?? defaultSel(cells, today);

  // How many bar lanes fit: measured row height and OS text size, capped by the
  // group's display limit (same setting the web uses, default 3).
  const rows = cells.length / 7;
  const rowH = gridH > 0 ? gridH / rows : 0;
  const { fontScale, barH, laneGap, numH, moreH } = cellMetrics(PixelRatio.getFontScale());
  const fit = rowH > 0 ? Math.max(0, Math.floor((rowH - numH - moreH) / (barH + laneGap))) : 0;
  const maxLanes = Math.min(fit, limit);
  const compactLanes = Math.min(COMPACT.lanes, limit);

  return (
    <>
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
                // Other-month days keep their weekend / holiday hue; the fade layer over them lightens it.
                const numColor = isToday
                  ? c.onPrimary
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
                    onPress={() => onPressDay(key, isSel, bars)}
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
                      // 2px gap between day cells, except inside a multi-day block (Samsung Calendar joins them).
                      marginVertical: 1,
                      marginLeft: tint.joinPrev ? 0 : 1,
                      marginRight: tint.joinNext ? 0 : 1,
                      backgroundColor: base,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    {wash ? <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: wash }} /> : null}
                    {/* Selected day: a thin gray, fully rounded outline (even inside a joined multi-day block). */}
                    {isSel ? <SelRing color={c.text2} /> : null}
                    <View style={{ alignSelf: "center", minWidth: 24, height: 24 * fontScale, paddingHorizontal: 4, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: isToday ? c.primary : "transparent" }}>
                      <T variant="footnote" color={numColor}>
                        {parseKey(key).day}
                      </T>
                    </View>
                    <View style={{ flex: 1 }} />
                    {more > 0 && !split ? (
                      <T variant="caption" color={c.text2} style={{ textAlign: "center", fontSize: MORE.fontSize, lineHeight: MORE.lineHeight }}>
                        +{more}
                      </T>
                    ) : null}
                    {/* Web calendar marks: blue dot = attendance, red dot = overtime (blue sits left of red). */}
                    {inMonth && marks.attendance ? <Dot color={c.saturday} right={marks.overtime ? 14 : 4} /> : null}
                    {inMonth && marks.overtime ? <Dot color={c.sunday} right={4} /> : null}
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

              {/* Other-month days: a wash of the page color over the cell AND its bars, so the
                  whole day recedes and the month edge reads at a glance (One UI). */}
              {week.map(({ key, inMonth }, col) =>
                inMonth ? null : (
                  <View
                    key={`fade-${key}`}
                    pointerEvents="none"
                    style={{ position: "absolute", top: 0, bottom: 0, left: `${(col / 7) * 100}%`, width: `${100 / 7}%`, backgroundColor: `${c.surface}${OTHER_MONTH_FADE}` }}
                  />
                ),
              )}
            </View>
          );
        })}
    </>
  );
});

/** Selected-day outline. It doesn't slide between cells: the old one just goes, the new one fades in (One UI). */
function SelRing({ color }: { color: string }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    timeTo(v, 1, DUR.swap, EASE_OUT);
  }, [v]);
  return <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10, borderWidth: 1, borderColor: color, opacity: v }} />;
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
