import { useEffect, useState } from "react";
import { Animated, Keyboard, Pressable, View } from "react-native";
import { addDays, longLabel, makeKey, parseKey, shiftMonth, shortLabel, todayKey, weekday, WEEKDAYS, type DateKey } from "@/lib/date";
import { holidayInfo } from "@/lib/holidays";
import { EASE_IN, EASE_OUT, prefersReducedMotion } from "@/lib/motion";
import { useHolidays } from "@/lib/useHolidays";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { T } from "./ui";

type Target = "start" | "end";

// Panel geometry: always six weeks, so the height is known before it opens (no measuring).
const HEAD_H = 52;
const WEEK_H = 28;
const ROW_H = 42;
const PANEL_H = HEAD_H + WEEK_H + ROW_H * 6 + 10;

// Motion (from the Samsung Calendar recording): the panel grows top-down with a long ease-out
// while the month fades in just behind it; closing fades the month first, then folds the space.
const OPEN_MS = 340;
const CLOSE_MS = 300;
const FADE_IN_MS = 180;
const FADE_OUT_MS = 140;

/**
 * "11월 16일 (월) → 11월 19일 (목)". Tapping a date gives it a gray pill and unfolds a month
 * calendar under the row to pick it; tapping it again (or the other date) folds or switches.
 */
export function DateRangeField({
  start,
  end,
  onChangeStart,
  onChangeEnd,
}: {
  start: DateKey;
  end: DateKey;
  onChangeStart: (k: DateKey) => void;
  onChangeEnd: (k: DateKey) => void;
}) {
  const { c } = useTheme();
  const [target, setTarget] = useState<Target | null>(null);
  // What the panel shows: stays on the last date while the panel folds away.
  const [shown, setShown] = useState<Target | null>(null);
  if (target && shown !== target) setShown(target);
  // Under "reduce motion" nothing folds, so a closed panel goes at once.
  const focus = target ?? (prefersReducedMotion() ? null : shown);
  const focusKey = focus === "end" ? end : start;

  // The month on screen; jumps to the tapped date's month whenever a date is tapped.
  const [view, setView] = useState<{ year: number; month: number }>(() => parseKey(start));
  const [viewFor, setViewFor] = useState<string | null>(null);
  const openKey = target ? `${target}:${focusKey}` : null;
  if (openKey && openKey !== viewFor) {
    setViewFor(openKey);
    const p = parseKey(focusKey);
    if (p.year !== view.year || p.month !== view.month) setView(p);
  }

  const [grow] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  const isOpen = target !== null;

  useEffect(() => {
    if (prefersReducedMotion()) {
      grow.setValue(isOpen ? 1 : 0);
      fade.setValue(isOpen ? 1 : 0);
      return;
    }
    const anim = isOpen
      ? Animated.parallel([
          Animated.timing(grow, { toValue: 1, duration: OPEN_MS, easing: EASE_OUT, useNativeDriver: false }),
          Animated.sequence([Animated.delay(40), Animated.timing(fade, { toValue: 1, duration: FADE_IN_MS, easing: EASE_OUT, useNativeDriver: false })]),
        ])
      : Animated.parallel([
          Animated.timing(fade, { toValue: 0, duration: FADE_OUT_MS, easing: EASE_IN, useNativeDriver: false }),
          Animated.sequence([Animated.delay(40), Animated.timing(grow, { toValue: 0, duration: CLOSE_MS, easing: EASE_OUT, useNativeDriver: false })]),
        ]);
    anim.start(({ finished }) => {
      if (finished && !isOpen) setShown(null);
    });
    return () => anim.stop();
  }, [isOpen, grow, fade]);

  function tap(t: Target) {
    Keyboard.dismiss();
    setTarget(target === t ? null : t);
  }

  function pick(k: DateKey) {
    if (focus === "end") {
      onChangeEnd(k);
    } else {
      onChangeStart(k);
      if (end < k) onChangeEnd(k);
    }
    const p = parseKey(k);
    if (p.year !== view.year || p.month !== view.month) setView(p);
  }

  return (
    <View>
      {/* The pills' own side padding hangs outside the row, so the dates line up with the card's text. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 72, marginHorizontal: -12 }}>
        <DatePill label="시작" value={start} active={target === "start"} onPress={() => tap("start")} />
        <View style={{ flex: 1, alignItems: "center" }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icon name="arrow" size={20} color={c.text2} />
        </View>
        <DatePill label="종료" value={end} active={target === "end"} onPress={() => tap("end")} />
      </View>

      {focus ? (
        <Animated.View style={{ height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, PANEL_H] }), overflow: "hidden" }}>
          {/* Laid out at full height and clipped by the growing box, so it reveals top-down. */}
          <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, height: PANEL_H, opacity: fade }}>
            <MonthPanel
              year={view.year}
              month={view.month}
              start={start}
              end={end}
              focus={focus ?? "start"}
              onMonth={(d) => setView(shiftMonth(view.year, view.month, d))}
              onPick={pick}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function DatePill({ label, value, active, onPress }: { label: string; value: DateKey; active: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const [on] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      on.setValue(active ? 1 : 0);
      return;
    }
    // Lights up at once on tap; dims slowly once the panel folds.
    const a = Animated.timing(on, { toValue: active ? 1 : 0, duration: active ? 120 : 320, easing: EASE_OUT, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [active, on]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} 날짜, ${longLabel(value)}`}
      accessibilityHint={active ? "달력 닫기" : "달력에서 날짜 고르기"}
      accessibilityState={{ expanded: active }}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 22 }}
    >
      <Animated.View style={{ position: "absolute", top: 2, bottom: 2, left: 0, right: 0, borderRadius: 20, backgroundColor: c.fill, opacity: on }} />
      <T variant="body" style={{ fontSize: 15, fontWeight: active ? "700" : "500" }}>
        {shortLabel(value)}
      </T>
    </Pressable>
  );
}

function MonthPanel({
  year,
  month,
  start,
  end,
  focus,
  onMonth,
  onPick,
}: {
  year: number;
  month: number;
  start: DateKey;
  end: DateKey;
  focus: Target;
  onMonth: (delta: number) => void;
  onPick: (k: DateKey) => void;
}) {
  const { c, isDark } = useTheme();
  const holidays = useHolidays();
  const today = todayKey();
  const first = makeKey(year, month, 1);
  const gridStart = addDays(first, -weekday(first));
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  const ring = isDark ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.55)";

  return (
    <View style={{ paddingBottom: 10 }}>
      <View style={{ height: HEAD_H, flexDirection: "row", alignItems: "center", gap: 4, marginLeft: -10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => onMonth(-1)} hitSlop={4} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Icon name="back" size={22} color={c.text2} />
        </Pressable>
        <T variant="body" accessibilityRole="header" style={{ fontSize: 17, fontWeight: "600", minWidth: 108, textAlign: "center" }}>
          {`${year}년 ${month}월`}
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 달" onPress={() => onMonth(1)} hitSlop={4} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Icon name="forward" size={22} color={c.text2} />
        </Pressable>
      </View>

      <View style={{ height: WEEK_H, flexDirection: "row", alignItems: "center" }}>
        {WEEKDAYS.map((w, i) => (
          <T key={w} variant="caption" color={i === 0 ? c.sunday : i === 6 ? c.saturday : c.muted} style={{ flex: 1, textAlign: "center", fontSize: 12 }}>
            {w}
          </T>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={week[0]} style={{ height: ROW_H, flexDirection: "row", alignItems: "center" }}>
          {week.map((k, col) => {
            const inMonth = parseKey(k).month === month;
            const inRange = start <= k && k <= end;
            const isStart = k === start;
            const isEnd = k === end;
            const disabled = focus === "end" && k < start;
            const hol = holidayInfo(k, holidays);
            const wd = col;
            const base = hol.holiday || (wd === 0 && !hol.workday) ? c.sunday : wd === 6 && !hol.workday ? c.saturday : c.text;
            const color = inRange ? c.onPrimary : k === today ? c.primaryText : base;
            const editing = (focus === "start" && isStart) || (focus === "end" && isEnd);
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`${longLabel(k)}${isStart ? ", 시작" : ""}${isEnd ? ", 종료" : ""}`}
                accessibilityState={{ selected: editing, disabled }}
                disabled={disabled}
                onPress={() => onPick(k)}
                style={{ flex: 1, height: ROW_H, alignItems: "center", justifyContent: "center" }}
              >
                {inRange ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 4,
                      bottom: 4,
                      left: 0,
                      right: 0,
                      backgroundColor: c.primary,
                      borderTopLeftRadius: isStart ? 17 : 0,
                      borderBottomLeftRadius: isStart ? 17 : 0,
                      borderTopRightRadius: isEnd ? 17 : 0,
                      borderBottomRightRadius: isEnd ? 17 : 0,
                    }}
                  />
                ) : null}
                {editing ? <View style={{ position: "absolute", width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: ring }} /> : null}
                <T
                  variant="subhead"
                  color={color}
                  style={{ fontSize: 15, fontWeight: inRange || k === today ? "700" : "500", opacity: disabled ? 0.3 : inMonth || inRange ? 1 : 0.38 }}
                >
                  {parseKey(k).day}
                </T>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
