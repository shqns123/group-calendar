import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, PixelRatio, Platform, Pressable, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector, usePanGesture, type PanGesture } from "react-native-gesture-handler";
import Reanimated, { cancelAnimation, Extrapolation, interpolate, ReduceMotion, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { MiniButton } from "@/components/list";
import { DUR, EASE_OUT, prefersReducedMotion, timeTo } from "@/lib/motion";
import { ErrorBanner, T } from "@/components/ui";
import { api } from "@/lib/api";
import { dayMarks, eventsOn, isElevated, layoutWeek } from "@/lib/calendar";
import { addDays, dotted, keyToIso, longLabel, monthGrid, monthLabel, parseKey, shiftMonth, todayKey, toKey, WEEKDAYS, WEEKDAYS_LONG, weekday, type DateKey } from "@/lib/date";
import { splitList } from "@/lib/roster";
import { useSession } from "@/lib/session";
import type { CalEvent, CustomHoliday, Me } from "@/lib/types";
import { useData } from "@/lib/useData";
import { STRIP_SPAN, useMonthPager } from "@/lib/useMonthPager";
import { holidayInfo } from "@/lib/holidays";
import { permissionsFor } from "@/lib/permissions";
import { useQuickAddDock, useTabBarBand } from "@/lib/quickAddDock";
import { useHolidays } from "@/lib/useHolidays";
import { useTheme } from "@/theme/ThemeProvider";
import { rememberedMonth, rememberMonth, useSplit, useWide, useWideDay, useWideMode } from "@/lib/wide";
import Feather from "@expo/vector-icons/Feather";
import { DayDetail } from "../day/[date]";
import { radius } from "@/theme/tokens";

// Event bars use the web calendar's style on purpose (CalendarView eventContent + globals.css .fc-event):
// event color at 0x28 alpha behind event-colored text, 0.62rem (≈10px) / 600, 4px corners.
// This is a documented exception to DESIGN.md's 12px floor and ink-text rule.
const BAR = {
  washAlpha: "28",
  fontSize: 10,
  lineHeight: 12.5,
  radius: 4,
} as const;
// Other-month days: page-color wash on top (hex alpha ≈ 64%) — numbers end up ~⅓ strength, like One UI.
const OTHER_MONTH_FADE = "A3";
// "+N" under the bars when a day has more than fit.
const MORE = { fontSize: 11, lineHeight: 14 } as const;
/** Row under "+N" for the status dots (6px dot + 2px gap), so the two never share a line. */
const DOT_ROW = 8;
// Day cells (canvas): faint gray base; days with events take a lighter wash of the top bar color.
// Day cell tint from its top event color: ≈2.7% (light) / ≈4.7% (dark) over the gray base.
const CELL = {
  alpha: { light: "07", dark: "0C" },
  base: { light: "#FBFBFC", dark: "#141414" },
} as const;
/**
 * Dark calendar palette, sampled from Samsung Calendar's dark month view: a black page with
 * neutral gray day cells (no blue cast), so the cells read clearly against the page. Light mode
 * keeps the app theme.
 */
const CAL_DARK = { page: "#000000", pill: "#1E1E1E", fade: "80" } as const;
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
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { group, me } = useSession();
  const elevated = isElevated(group, me);
  const holidays = useHolidays();
  const perms = permissionsFor(group, me);
  const today = todayKey();
  // Start on the month that was on screen (switching 분할 ↔ 전체화면 mounts a new calendar view).
  const [ym, setYm] = useState(
    () =>
      rememberedMonth() ?? {
        year: parseKey(today).year,
        month: parseKey(today).month,
      },
  );
  useEffect(() => {
    rememberMonth(ym);
  }, [ym]);
  const wide = useWide();
  const { full, toggleFull } = useWideMode();
  const [split, setSplit] = useState(false);
  const [pickedLocal, setPickedLocal] = useState<DateKey | null>(null);
  const wideDay = useWideDay();
  // In the wide layout the picked day is shared with the right pane.
  const picked = pane ? wideDay.date : pickedLocal;
  const setPicked = pane ? wideDay.setDate : setPickedLocal;
  // 0 = full month … 1 = list view. A Reanimated shared value: the month's height, the bar fades
  // and the list's fade are worked out on the UI thread every frame, so the swipe stays smooth
  // even while JS is busy (rendering the list view, fetching).
  const progress = useSharedValue(0);
  const [areaH, setAreaH] = useState(0);
  // The full-month grid's height (lane fitting) is the whole area at rest; taken from the area, not
  // the grid's own layout, which changes all through the up / down swipe.
  const gridH = areaH > 0 ? areaH - 4 : 0;

  const index = ym.year * 12 + ym.month - 1;
  const cells = useMemo(() => monthGrid(ym.year, ym.month), [ym]);
  const first = cells[0].key;
  const last = cells[cells.length - 1].key;

  // Same key as the current MonthPage, so this is served from the cache (used by the day list).
  const { data: events } = useData(group ? `events:${group.id}:${first}` : null, () =>
    api<CalEvent[]>("/api/events", {
      query: {
        groupId: group!.id,
        start: keyToIso(first),
        end: keyToIso(addDays(last, 7)),
      },
    }),
  );

  const rows = cells.length / 7;
  // The tab bar floats over the bottom of the month: one more week of the next month goes under
  // it, its date row peeking out above the bar (the month's own weeks fill the space above).
  // Not in the wide layout's calendar pane.
  const { numH } = cellMetrics(PixelRatio.getFontScale());
  const band = useTabBarBand();
  const tail = pane || (wide && !full) ? 0 : band + numH + 2;
  const limit = Math.max(1, Math.min(10, group?.eventDisplayLimit ?? 3));

  // Open / close the list (handle tap, screen reader). `velocity` = progress per second. The spring
  // runs on the UI thread; `split` (the list is open: taps select days) flips once it lands.
  const changeSplit = (on: boolean, velocity = 0) => {
    cancelAnimation(progress);
    if (prefersReducedMotion()) {
      progress.value = on ? 1 : 0;
      setSplit(on);
      return;
    }
    progress.value = withSpring(
      on ? 1 : 0,
      {
        velocity,
        stiffness: 240,
        damping: 30,
        mass: 1,
        overshootClamping: true,
      },
      (finished) => {
        if (finished) scheduleOnRN(setSplit, on);
      },
    );
  };

  // --- Up / down swipe, entirely on the UI thread (Gesture Handler + Reanimated): the finger moves
  // `progress` directly, so the month follows it even while JS is busy, and nothing re-renders
  // until the swipe has landed. The list is always mounted under the month (zero height while
  // closed), so opening it doesn't have to build anything either.
  const areaSV = useSharedValue(0);
  const compactSV = useSharedValue(0);
  const dragFrom = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const listAtTop = useSharedValue(true);
  const swipeActivate = (e: { translationY: number }) => {
    "worklet";
    cancelAnimation(progress);
    dragFrom.value = progress.value;
    dragStartY.value = e.translationY;
  };
  const swipeUpdate = (e: { translationY: number }) => {
    "worklet";
    const travel = Math.max(80, areaSV.value - compactSV.value);
    const p = dragFrom.value - (e.translationY - dragStartY.value) / travel;
    progress.value = Math.min(1, Math.max(0, p));
  };
  const swipeEnd = (e: { velocityY: number; canceled: boolean }) => {
    "worklet";
    const travel = Math.max(80, areaSV.value - compactSV.value);
    const p = progress.value;
    const from = dragFrom.value;
    const moved = p - from;
    // A flick decides by direction; a slow release by how far the month moved (a short nudge
    // snaps back).
    const on = e.canceled ? from > 0.5 : e.velocityY < -300 ? true : e.velocityY > 300 ? false : Math.abs(moved) > 0.2 ? moved > 0 : from > 0.5;
    progress.value = withSpring(
      on ? 1 : 0,
      {
        velocity: -e.velocityY / travel,
        stiffness: 240,
        damping: 30,
        mass: 1,
        overshootClamping: true,
        reduceMotion: ReduceMotion.System,
      },
      (finished) => {
        if (finished) scheduleOnRN(setSplit, on);
      },
    );
  };
  // On the month: clear vertical drags only (a sideways drag is month paging).
  const monthSwipe = usePanGesture({
    activeOffsetY: [-12, 12],
    failOffsetX: [-12, 12],
    onActivate: swipeActivate,
    onUpdate: swipeUpdate,
    onDeactivate: swipeEnd,
  });
  // On the list: pull down to close, anywhere on it, once its events are scrolled to the top
  // (otherwise the pull scrolls them back up). Upward drags are left to the scroll.
  const listSwipe = usePanGesture({
    enabled: listAtTop,
    activeOffsetY: 10,
    failOffsetY: -10,
    failOffsetX: [-20, 20],
    onActivate: swipeActivate,
    onUpdate: swipeUpdate,
    onDeactivate: swipeEnd,
  });
  const pager = useMonthPager(index, (delta) => {
    setPicked(null);
    setYm((cur) => shiftMonth(cur.year, cur.month, delta));
  });
  /** The square date button: back to this month and today, selected. */
  const goToday = () => {
    const t = parseKey(today);
    const ti = t.year * 12 + t.month - 1;
    // Next door: slide there like the arrows. Farther: jump straight there.
    if (Math.abs(ti - pager.heading) === 1) pager.go(ti - pager.heading);
    else pager.jump(ti);
    setPicked(today);
  };
  // Selected day (first tap selects, second tap opens the day sheet): what was tapped, else today in this month, else the 1st.
  const sel = picked && cells.some((x) => x.key === picked) ? picked : defaultSel(cells, today);
  // The tab bar's + quick add puts a line without a date on the selected day.
  const { setDate: setDockDate } = useQuickAddDock();
  useEffect(() => {
    setDockDate(sel);
  }, [sel, setDockDate]);
  const compactLanes = Math.min(COMPACT.lanes, limit);
  const compactRowH = numH + compactLanes * (COMPACT.line + COMPACT.gap) + 10;
  // The month's height follows the swipe directly (full area → just its weeks in list rows).
  const compactH = Math.min(areaH, rows * compactRowH + 4);
  // Only the height is animated. Before the area is measured the month just fills it (a plain
  // style, which React removes again; Reanimated only ever adds keys, so a `flex: 1` from the
  // animated style would stick and share the space with the list).
  const monthStyle = useAnimatedStyle(() => (areaH > 0 ? { height: interpolate(progress.value, [0, 1], [areaH, compactH], Extrapolation.CLAMP) } : {}));
  useEffect(() => {
    areaSV.value = areaH;
    compactSV.value = compactH;
  }, [areaH, compactH, areaSV, compactSV]);
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
  // No list-open flag here: the month pages don't re-render when the list opens or closes (both bar
  // styles stay mounted; only their opacity changes, on the UI thread).
  const pageProps = {
    groupId: group?.id ?? null,
    today,
    listIn: progress,
    gridH,
    tail,
    limit,
    me,
    elevated,
    holidays,
    onPressDay,
  };
  const W = pager.width;
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? CAL_DARK.page : c.surface }}>
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingLeft: 20,
          paddingRight: 12,
          paddingBottom: 8,
          gap: 2,
        }}
      >
        {/* Canvas: no top row (group switch and 오늘 live elsewhere) — just ‹ 11월 ›. */}
        {/* 11월 on the left, today's date in a square on the right. Months change by swiping the
            grid (no arrows); screen readers get 이전 달 / 다음 달 as actions on the title. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginRight: -4,
          }}
        >
          {/* Flips the moment the finger lifts (pager.heading), not when the slide lands. */}
          <T
            variant="title1"
            accessibilityRole="header"
            accessibilityLabel={monthLabel(Math.floor(pager.heading / 12), (pager.heading % 12) + 1)}
            accessibilityActions={[
              { name: "decrement", label: "이전 달" },
              { name: "increment", label: "다음 달" },
            ]}
            onAccessibilityAction={(e) => pager.go(e.nativeEvent.actionName === "increment" ? 1 : -1)}
            style={{
              flex: 1,
              fontSize: 24,
              lineHeight: 30,
              letterSpacing: -0.4,
            }}
          >
            {`${(pager.heading % 12) + 1}월`}
          </T>
          <TodayButton day={parseKey(today).day} label={`오늘로 이동, ${longLabel(today)}`} onPress={goToday} />
          {/* Wide screens: 분할 ↔ 전체화면. */}
          {wide ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={full ? "분할 화면으로 보기" : "캘린더 전체 화면으로 보기"}
              onPress={toggleFull}
              hitSlop={4}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? c.fill : "transparent",
              })}
            >
              <Feather name={full ? "columns" : "maximize-2"} size={20} color={c.text2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{
          flexDirection: "row",
          paddingHorizontal: 4,
          paddingTop: 6,
          paddingBottom: 4,
        }}
      >
        {WEEKDAYS.map((w, i) => (
          <T key={w} variant="footnote" style={{ flex: 1, textAlign: "center", fontSize: 12 }} color={i === 0 ? c.sunday : i === 6 ? c.saturday : c.text2}>
            {w}
          </T>
        ))}
      </View>

      {!group ? <ErrorBanner message="속한 그룹이 없어요. 웹에서 초대 링크로 그룹에 가입해 주세요." /> : null}

      <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setAreaH(e.nativeEvent.layout.height)}>
        <GestureDetector gesture={monthSwipe}>
          <Reanimated.View
            {...pager.panHandlers}
            accessibilityActions={[
              {
                name: "toggleList",
                label: split ? "일정 목록 닫기" : "선택한 날 일정 목록 보기",
              },
            ]}
            onAccessibilityAction={() => changeSplit(!split)}
            // The height always follows the swipe (progress) directly, from the first frame: waiting for
            // React to render the list view made the rows grow and slide down, then jump.
            style={[{ overflow: "hidden" }, areaH > 0 ? null : { flex: 1 }, monthStyle]}
            onLayout={(e: LayoutChangeEvent) => pager.setWidth(e.nativeEvent.layout.width)}
          >
            {W > 0 ? (
              // One strip, pages placed by absolute month index: the drag and the fling move all three
              // together, and a month change only adds a new neighbor off screen (nothing jumps).
              <Animated.View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: -STRIP_SPAN * W,
                  width: (STRIP_SPAN * 2 + 1) * W,
                  transform: [{ translateX: pager.slide }],
                }}
              >
                {[-1, 0, 1].map((d) => {
                  const m = shiftMonth(ym.year, ym.month, d);
                  const mi = index + d;
                  return (
                    <View
                      key={mi}
                      importantForAccessibility={d === 0 ? "auto" : "no-hide-descendants"}
                      accessibilityElementsHidden={d !== 0}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        width: W,
                        left: (mi - pager.base + STRIP_SPAN) * W,
                        paddingHorizontal: 4,
                        paddingBottom: 4,
                      }}
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
          </Reanimated.View>
        </GestureDetector>

        {/* Always mounted, under the month: zero height while closed. Its top is the month's bottom
          edge, so it slides up from below with the swipe, fully drawn (One UI). */}
        {areaH > 0 ? (
        <View style={{ flex: 1 }} importantForAccessibility={split ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={!split}>
          <DayList
            date={sel}
            events={events ? eventsOn(events, sel).filter((e) => !e.isOvertimeOnly) : null}
            holiday={holidayInfo(sel, holidays).name}
            pull={listSwipe}
            atTop={listAtTop}
            onClose={() => changeSplit(false)}
            onOpenDay={() => router.push({ pathname: "/day/[date]", params: { date: sel } })}
            onOpenEvent={
              perms.canWriteEvents
                ? (id) =>
                    router.push({
                      pathname: "/event/edit",
                      params: { id, date: sel },
                    })
                : undefined
            }
            bottomPad={band + 24}
          />
        </View>
        ) : null}
      </View>
    </View>
  );
}

/** Today's date in a rounded square (One UI's 오늘 button): back to today, selected. */
function TodayButton({ day, label, onPress }: { day: number; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? c.fill : "transparent",
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 1.6,
          borderColor: c.text,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <T
          variant="caption"
          color={c.text}
          style={{
            fontSize: 12,
            lineHeight: 14,
            fontWeight: "700",
            includeFontPadding: false,
          }}
        >
          {day}
        </T>
      </View>
    </Pressable>
  );
}

/** Bar / cell sizes for the OS text size. */
function cellMetrics(fontScale: number) {
  return {
    fontScale,
    barH: Math.ceil((BAR.lineHeight + 3) * fontScale),
    laneGap: 2,
    numH: 4 + Math.ceil(24 * fontScale) + 2,
    // Bottom of the cell: the "+N" line, the dot row under it (memo left; attendance/overtime
    // right), and the cell's bottom padding.
    moreH: Math.ceil(MORE.lineHeight * fontScale) + 6 + DOT_ROW,
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
  /** 0 = full month … 1 = list view; follows the up / down swipe (bars cross-fade with it). */
  listIn: SharedValue<number>;
  gridH: number;
  /** Height of the extra next-month week under the floating tab bar (0 = none). */
  tail: number;
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
const MonthPage = memo(function MonthPage({ year, month, sel: selProp, groupId, today, listIn, gridH, tail, limit, me, elevated, holidays, onPressDay }: MonthPageProps) {
  const { c, isDark } = useTheme();
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const first = cells[0].key;
  // Loaded one week past the grid: the extra next-month week under the tab bar.
  const last = addDays(cells[cells.length - 1].key, 7);
  const { data: events } = useData(groupId ? `events:${groupId}:${first}` : null, () =>
    api<CalEvent[]>("/api/events", {
      query: {
        groupId: groupId!,
        start: keyToIso(first),
        end: keyToIso(last),
      },
    }),
  );
  // Days with a work memo (업무 메모) get a yellow dot, like the web calendar's memo mark.
  const { data: memoData } = useData(groupId ? `daynotes:${groupId}:${first}` : null, () =>
    api<{ notes: { date: string; items?: { text?: string }[] }[] }>("/api/day-notes", { query: { groupId: groupId!, start: first, end: last } }),
  );
  const memoDays = useMemo(() => new Set((memoData?.notes ?? []).filter((n) => n.items?.some((i) => i.text?.trim())).map((n) => n.date)), [memoData]);
  const sel = selProp ?? defaultSel(cells, today);

  // How many bar lanes fit: measured row height and OS text size, capped by the
  // group's display limit (same setting the web uses, default 3).
  const rows = cells.length / 7;
  // Full month: the month's weeks share the space above the tab bar; one more (next-month) week
  // of `tail` height sits under it. Opening the list shrinks that week away with the swipe.
  const extra = tail > 0;
  const shown = useMemo(
    () =>
      extra
        ? [
            ...cells,
            ...Array.from({ length: 7 }, (_, i) => ({
              key: addDays(cells[cells.length - 1].key, i + 1),
              inMonth: false,
            })),
          ]
        : cells,
    [cells, extra],
  );
  const rowH = gridH > 0 ? (gridH - (extra ? tail : 0)) / rows : 0;
  const { fontScale, barH, laneGap, numH, moreH } = cellMetrics(PixelRatio.getFontScale());
  const numDot = Math.round(24 * fontScale);
  const fit = rowH > 0 ? Math.max(0, Math.floor((rowH - numH - moreH) / (barH + laneGap))) : 0;
  const maxLanes = Math.min(fit, limit);
  const compactLanes = Math.min(COMPACT.lanes, limit);
  // One UI (Samsung Calendar): swiping up, the titled bars (and "+N") are gone within the first
  // quarter; the rows then shrink with no bars, only the days' color wash; the thin list-view bars
  // come in over the last fifth. Swiping down plays it back: thin bars out first, titled bars last.
  // One animated style per role, shared by every view in that role (UI thread).
  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(listIn.value, [0, 0.25], [1, 0], Extrapolation.CLAMP),
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(listIn.value, [0.8, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const tailStyle = useAnimatedStyle(() => ({
    height: interpolate(listIn.value, [0, 1], [tail, 0], Extrapolation.CLAMP),
  }));
  // The day dots go with the titled bars and come back with the thin ones, so the cells are clean
  // while they shrink / grow.
  const dotsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(listIn.value, [0, 0.25, 0.8, 1], [1, 0, 0, 1], Extrapolation.CLAMP),
  }));

  return (
    <>
      {Array.from({ length: shown.length / 7 }, (_, r) => {
        const week = shown.slice(r * 7, r * 7 + 7);
        const keys = week.map((w) => w.key);
        // Both bar styles stay mounted (titled + thin list-view lines) and cross-fade with the
        // swipe, so opening / closing the list never has to re-render the month.
        const layout = layoutWeek(events ?? [], keys, maxLanes);
        const compactLayout = layoutWeek(events ?? [], keys, compactLanes);
        return (
          <Reanimated.View key={r} style={r < rows ? { flex: 1, flexDirection: "row" } : [{ flexDirection: "row", overflow: "hidden" }, tailStyle]}>
            {week.map(({ key, inMonth }, col) => {
              const marks = events ? dayMarks(events, key, me, elevated) : { attendance: false, overtime: false };
              const bars = layout.total[col];
              const more = layout.hidden[col];
              const wd = weekday(key);
              const isToday = key === today;
              const isSel = key === sel;
              const hol = holidayInfo(key, holidays);
              const tint = layout.cellTint[col];
              // A multi-day block joins its cells only within one month: where it crosses into
              // (or comes from) another month, the other-month day is faded, so a join there
              // would leave this day with a square corner. Both sides stay rounded instead.
              const joinPrev = tint.joinPrev && col > 0 && week[col - 1].inMonth === inMonth;
              const joinNext = tint.joinNext && col < 6 && week[col + 1].inMonth === inMonth;
              // Gray base always; a day with events lays a light wash of its top bar color over it.
              const base = isDark ? CELL.base.dark : CELL.base.light;
              const wash = tint.color && /^#[0-9a-f]{6}$/i.test(tint.color) ? `${tint.color}${isDark ? CELL.alpha.dark : CELL.alpha.light}` : null;
              // Other-month days keep their weekend / holiday hue; the fade layer over them lightens it.
              const numColor = isToday ? c.onPrimary : hol.holiday || (wd === 0 && !hol.workday) ? c.sunday : wd === 6 && !hol.workday ? c.saturday : c.text;
              const label = [
                `${longLabel(key)}${inMonth ? "" : ", 다른 달"}`,
                hol.name ? (hol.workday ? `${hol.name}(근무일)` : hol.name) : null,
                bars ? `일정 ${bars}개` : "일정 없음",
                marks.attendance ? "근태 있음" : null,
                marks.overtime ? "특근 가능 표시" : null,
                memoDays.has(key) ? "업무 메모 있음" : null,
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
                  accessibilityHint={isSel || bars > 0 ? "상세 보기" : "날짜 선택"}
                  onPress={() => onPressDay(key, isSel, bars)}
                  style={({ pressed }) => ({
                    flex: 1,
                    overflow: "hidden",
                    paddingTop: 4,
                    // Dots sit in their own row at the very bottom; "+N" stays above them.
                    paddingBottom: 4 + DOT_ROW,
                    // A multi-day top bar joins its cells into one block (square inner corners).
                    borderTopLeftRadius: joinPrev ? 0 : 10,
                    borderBottomLeftRadius: joinPrev ? 0 : 10,
                    borderTopRightRadius: joinNext ? 0 : 10,
                    borderBottomRightRadius: joinNext ? 0 : 10,
                    // 2px gap between day cells, except inside a multi-day block (Samsung Calendar joins them).
                    marginVertical: 1,
                    marginLeft: joinPrev ? 0 : 1,
                    marginRight: joinNext ? 0 : 1,
                    backgroundColor: base,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  {wash ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: wash,
                      }}
                    />
                  ) : null}
                  {/* Selected day: a thin gray, fully rounded outline (even inside a joined multi-day block). */}
                  {isSel ? <SelRing color={c.text2} /> : null}
                  {/* Fixed square box → a true circle for every date (a padded min-width box stretched
                        two-digit dates into a pill). Today's circle is its own view, created with its
                        color and rounding together: on Android, giving an existing rounded view a
                        background later (today moving to this cell when the date changes with the app
                        open) drew it as a square. */}
                  <View
                    style={{
                      alignSelf: "center",
                      width: numDot,
                      height: numDot,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isToday ? (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: numDot,
                          height: numDot,
                          borderRadius: numDot / 2,
                          backgroundColor: c.primary,
                        }}
                      />
                    ) : null}
                    <T variant="footnote" color={numColor}>
                      {parseKey(key).day}
                    </T>
                  </View>
                  <View style={{ flex: 1 }} />
                  {more > 0 ? (
                    <Reanimated.View style={fullStyle}>
                      <T
                        variant="caption"
                        color={c.text2}
                        style={{
                          textAlign: "center",
                          fontSize: MORE.fontSize,
                          lineHeight: MORE.lineHeight,
                        }}
                      >
                        +{more}
                      </T>
                    </Reanimated.View>
                  ) : null}
                  {/* Web calendar marks: blue dot = attendance, red dot = overtime (blue sits left of red);
                        work memo: yellow dot at the bottom left. They fade out during the swipe. */}
                  {inMonth && (marks.attendance || marks.overtime || memoDays.has(key)) ? (
                    <Reanimated.View
                      pointerEvents="none"
                      style={[
                        {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                        },
                        dotsStyle,
                      ]}
                    >
                      {marks.attendance ? <Dot color={c.saturday} right={marks.overtime ? 14 : 4} /> : null}
                      {marks.overtime ? <Dot color={c.sunday} right={4} /> : null}
                      {memoDays.has(key) ? <Dot color={isDark ? MEMO_DOT.dark : MEMO_DOT.light} left={4} /> : null}
                    </Reanimated.View>
                  ) : null}
                </Pressable>
              );
            })}

            {/* Other-month days: a wash of the page color over the cell (date and background), so the
                  month edge reads at a glance. Drawn under the event bars: an event running into
                  the next / previous month keeps its full color there. */}
            {week.map(({ key, inMonth }, col) =>
              inMonth ? null : (
                <View
                  key={`fade-${key}`}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${(col / 7) * 100}%`,
                    width: `${100 / 7}%`,
                    backgroundColor: isDark ? `${CAL_DARK.page}${CAL_DARK.fade}` : `${c.surface}${OTHER_MONTH_FADE}`,
                  }}
                />
              ),
            )}
            {/* Event bars span their days within the week; taps fall through to the day cells.
                  Thin list-view bars (while the list is out) under the titled ones; they cross-fade. */}
            {compactLayout.segments.length ? (
              <Reanimated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: numH,
                    bottom: 0,
                  },
                  compactStyle,
                ]}
              >
                {compactLayout.segments.map((s) => (
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
                ))}
              </Reanimated.View>
            ) : null}
            <Reanimated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: numH,
                  bottom: 0,
                },
                fullStyle,
              ]}
            >
              {layout.segments.map((s) => (
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
                      style={{
                        textAlign: "center",
                        fontSize: BAR.fontSize,
                        lineHeight: BAR.lineHeight,
                        fontWeight: "600",
                      }}
                    >
                      {s.title}
                    </T>
                  </View>
                </View>
              ))}
            </Reanimated.View>

          </Reanimated.View>
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
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: color,
        opacity: v,
      }}
    />
  );
}

/** Status dot in the bottom-right corner of a day cell (web: .fc-day-attendance / .fc-day-overtime). */
function Dot({ color, right, left }: { color: string; right?: number; left?: number }) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 4,
        right,
        left,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
      }}
    />
  );
}

/** Work-memo dot: yellow. A deeper yellow on the light page so the small dot still shows. */
const MEMO_DOT = { light: "#EAB308", dark: "#FACC15" } as const;

/** Selected day's events under the shrunken month (split view). */
function DayList({
  date,
  events,
  holiday,
  pull,
  atTop,
  onClose,
  onOpenDay,
  onOpenEvent,
  bottomPad,
}: {
  date: DateKey;
  events: CalEvent[] | null;
  holiday: string | null | undefined;
  /** Pull down anywhere on the list to close it (UI thread; enabled while scrolled to the top). */
  pull: PanGesture;
  /** Whether the events are scrolled to the top (kept up to date here, read by `pull`). */
  atTop: SharedValue<boolean>;
  onClose: () => void;
  onOpenDay: () => void;
  onOpenEvent?: (id: string) => void;
  /** Room under the last event so it can scroll clear of the floating tab bar. */
  bottomPad: number;
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
        Animated.timing(slide, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }).start();
      });
    return () => {
      alive = false;
    };
  }, [date, slide, width]);
  const opacity = slide.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [0, 1, 0],
  });
  const onScroll = useAnimatedScrollHandler((e) => {
    atTop.set(e.contentOffset.y <= 0);
  });
  return (
    <GestureDetector gesture={pull}>
      <View
        style={{
          flex: 1,
          backgroundColor: c.bg,
          borderTopLeftRadius: radius.card,
          borderTopRightRadius: radius.card,
          overflow: "hidden",
        }}
      >
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="일정 목록 닫기"
            onPress={onClose}
            style={{
              height: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: c.handle,
              }}
            />
          </Pressable>
        </View>
        <Animated.View style={{ flex: 1, opacity, transform: [{ translateX: slide }] }}>
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: 20,
                paddingRight: 12,
                paddingBottom: 8,
                gap: 8,
              }}
            >
              <T variant="title2" accessibilityRole="header" accessibilityLabel={longLabel(date)}>
                {parseKey(date).day}
              </T>
              <T variant="subhead" style={{ flex: 1, fontWeight: "600" }} color={holiday ? c.sunday : c.text2} numberOfLines={1}>
                {[WEEKDAYS_LONG[weekday(date)], holiday].filter(Boolean).join(" · ")}
              </T>
              <MiniButton tone="neutral" label="자세히" onPress={onOpenDay} />
            </View>
          </View>
          <Reanimated.ScrollView
            scrollEventThrottle={16}
            onScroll={onScroll}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: Math.max(80, bottomPad),
              gap: 8,
            }}
          >
            {events && events.length === 0 ? (
              <T variant="subhead" color={c.muted} style={{ paddingHorizontal: 4, paddingVertical: 12 }}>
                이 날은 일정이 없어요.
              </T>
            ) : null}
            {(events ?? []).map((e) => {
              const s = toKey(e.startDate);
              const t = toKey(e.endDate);
              const people = splitList(e.personnel);
              const sub = [s === t ? null : `${dotted(s)} – ${dotted(t)}`, e.category === "ATTENDANCE" ? "근태" : e.equipmentOnly ? "장비 반출" : null, people.join(", ") || null].filter(Boolean).join(" · ");
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
                  <View
                    style={{
                      width: 4,
                      alignSelf: "stretch",
                      borderRadius: 2,
                      backgroundColor: e.color,
                    }}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    {/* Canvas (1b): title 15/600, sub-line 12/600. */}
                    <T
                      variant="subhead"
                      numberOfLines={1}
                      style={{
                        fontSize: 15,
                        lineHeight: 20,
                        fontWeight: "600",
                      }}
                    >
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
          </Reanimated.ScrollView>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
