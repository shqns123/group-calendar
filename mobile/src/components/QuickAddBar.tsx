import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, Animated, Keyboard, Platform, Pressable, ScrollView, TextInput, View, type KeyboardEvent } from "react-native";
import { api, errorMessage } from "@/lib/api";
import { parseKey, keyToIso, type DateKey } from "@/lib/date";
import { notice } from "@/lib/confirm";
import { DUR, EASE_IN, EASE_OUT, timeTo } from "@/lib/motion";
import { parseQuickAdd } from "@/lib/quickAdd";
import { myLabel, rosterOf, useSession } from "@/lib/session";
import type { EventInput } from "@/lib/types";
import { invalidate } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { EVENT_COLORS, radius } from "@/theme/tokens";
import { Icon } from "./Icon";
import { T } from "./ui";

const md = (k: DateKey) => `${parseKey(k).month}월 ${parseKey(k).day}일`;
/** Pill height (closed) = the input row of the open card. */
const BAR_H = 52;
/** Extra height of the open card: the chip row above the input. */
const ROW_H = 44;
/** Default: how far the open card widens past the pill on each side. */
const WIDEN = 8;
/** Space kept between the card and the top of the keyboard. */
const KEYBOARD_GAP = 8;
/** Starters offered while the field is empty (Samsung's "오전 8시" chip). Tapping one adds it. */
const STARTERS = ["오늘", "내일", "오전 9시", "오후 2시", "월휴"];

/**
 * Samsung-style quick add (month view and day popup). Type one line ("20~22일 광주 출장 김민수
 * 최유진", "내일 월휴", "오전 9시 회의") and it picks out the dates, time, people and title.
 *
 * Motion, measured from a One UI screen recording:
 * - Tap: the pill grows into a taller, wider card (~200ms, decelerating), anchored at its bottom;
 *   its chip row fades in after the card has room; + turns into a check (gray until the line is ready).
 * - The card rides on top of the keyboard.
 * - Keyboard away: the card snaps back to a pill at once (~90ms), then rides down; check → +.
 * - Save: the input is put away first; the new event lands on the calendar after that.
 */
export function QuickAddBar({
  date,
  tone = "float",
  widen = WIDEN,
  onActiveChange,
}: {
  date: DateKey;
  tone?: "float" | "inset";
  /** How far the open card grows past the pill on each side (a narrow pill opens up wide). */
  widen?: number;
  /** Typing mode on/off — the host lays a tap-to-dismiss layer over everything else while on. */
  onActiveChange?: (active: boolean) => void;
}) {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const { group, me } = useSession();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const roster = useMemo(() => rosterOf(group), [group]);

  const draft = useMemo(() => (text.trim() ? parseQuickAdd(text, date, roster) : null), [text, date, roster]);
  const ready = !!draft && (draft.category === "ATTENDANCE" || !!draft.title);

  // --- Pill ⇄ card. Layout props (height/insets) → JS driver.
  const [open] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (focused) timeTo(open, 1, 200, EASE_OUT, false);
    else timeTo(open, 0, 90, EASE_IN, false);
  }, [focused, open]);

  // --- Ride the keyboard: Android draws edge-to-edge, so the window doesn't shrink for the IME —
  // lift the card ourselves until it sits just above the keyboard.
  const [lift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const place = (e: KeyboardEvent) => {
      if (!input.current?.isFocused()) return;
      const top = e.endCoordinates.screenY;
      const dur = Platform.OS === "ios" && e.duration ? e.duration : DUR.keyboard;
      // The anchor isn't transformed, so this is where the pill sits with no lift.
      anchor.current?.measureInWindow((_x, y, _w, h) => {
        const over = y + h + KEYBOARD_GAP - top;
        timeTo(lift, over > 0 ? -over : 0, dur, EASE_OUT);
      });
    };
    const drop = () => {
      timeTo(lift, 0, DUR.keyboard, EASE_OUT);
      // Keyboard closed some other way (Android back): leave typing mode too.
      if (input.current?.isFocused()) input.current.blur();
    };
    const ios = Platform.OS === "ios";
    const subs = [
      Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", place),
      Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidChangeFrame", place),
      Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", drop),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [lift]);

  function onBlur() {
    setFocused(false);
    onActiveChange?.(false);
    // Start down with the keyboard rather than after it (Android reports the hide late).
    timeTo(lift, 0, DUR.keyboard, EASE_OUT);
  }

  // --- Button: 0 = clear (+), 1 = gray (check, not ready), 2 = accent (check/+, ready).
  const [tint] = useState(() => new Animated.Value(0));
  const tintTo = saving || ready ? 2 : focused ? 1 : 0;
  useEffect(() => {
    timeTo(tint, tintTo, DUR.swap, EASE_OUT, false);
  }, [tint, tintTo]);

  async function submit() {
    if (!draft) {
      router.push({ pathname: "/event/edit", params: { date } });
      return;
    }
    if (!group || !ready || saving) return;
    const body: EventInput = {
      category: draft.category,
      title: draft.title,
      description: draft.time ? `시간 ${draft.time}` : "",
      startDate: keyToIso(draft.start),
      endDate: keyToIso(draft.end),
      allDay: true,
      color: EVENT_COLORS[0].hex,
      groupId: group.id,
      // Same rule as the full form: nobody picked → trips default to the writer on the server,
      // 근태 is recorded for the writer.
      personnel: draft.people.length ? draft.people.join(", ") : draft.category === "ATTENDANCE" ? myLabel(group, me) : null,
      equipment: null,
      equipmentOnly: false,
    };
    setSaving(true);
    // Put the input away first (card → pill, keyboard down) …
    onBlur();
    input.current?.blur();
    Keyboard.dismiss();
    try {
      await Promise.all([api("/api/events", { method: "POST", body }), new Promise((r) => setTimeout(r, DUR.keyboard))]);
      // … then the result lands on the calendar.
      setText("");
      invalidate();
    } catch (e) {
      notice("추가하지 못했어요", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const add = (word: string) => {
    setText((t) => (t.trim() ? `${t.trimEnd()} ${word} ` : `${word} `));
    input.current?.focus();
  };

  // --- Chip row: what was understood, or starters while empty.
  const chips: { k: string; label: string; warn?: boolean }[] = draft
    ? [
        { k: "date", label: draft.start === draft.end ? md(draft.start) : `${md(draft.start)} – ${md(draft.end)}` },
        ...(draft.time ? [{ k: "time", label: draft.time }] : []),
        draft.category === "ATTENDANCE"
          ? { k: "kind", label: `근태 · ${draft.title}` }
          : draft.title
            ? { k: "kind", label: `출장 · ${draft.title}` }
            : { k: "kind", label: "제목을 적어 주세요", warn: true },
        ...(draft.people.length ? [{ k: "people", label: draft.people.join(", ") }] : []),
      ]
    : [];

  const inset = tone === "inset";
  const example = `예: 내일 오전 9시 광주 출장 ${roster[0] ?? "김민수"}`;
  const btnBg = tint.interpolate({ inputRange: [0, 1, 2], outputRange: [`${c.fill}00`, c.fill, c.primary] });
  const glyph = saving ? "spin" : focused || ready ? "check" : "add";
  const label = saving ? "추가하는 중" : draft ? "추가" : focused ? "추가할 내용을 적어 주세요" : "자세히 입력";

  return (
    <View ref={anchor} collapsable={false} style={{ height: BAR_H }}>
      <Animated.View style={{ position: "absolute", left: 0, right: 0, bottom: 0, transform: [{ translateY: lift }] }}>
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: open.interpolate({ inputRange: [0, 1], outputRange: [0, -widen] }),
            right: open.interpolate({ inputRange: [0, 1], outputRange: [0, -widen] }),
            height: open.interpolate({ inputRange: [0, 1], outputRange: [BAR_H, BAR_H + ROW_H] }),
            borderRadius: open.interpolate({ inputRange: [0, 1], outputRange: [BAR_H / 2, 24] }),
            overflow: "hidden",
            justifyContent: "flex-end",
            backgroundColor: inset && !focused ? c.subtle : c.card,
            shadowColor: "#0F172A",
            shadowOpacity: inset && !focused ? 0 : isDark ? 0.5 : focused ? 0.16 : 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: inset && !focused ? 0 : 6,
          }}
        >
          {/* Chip row: fades in once the card has grown (content after container). */}
          <Animated.View style={{ height: ROW_H, opacity: open.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }) }}>
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="always"
              showsHorizontalScrollIndicator={false}
              accessibilityLiveRegion="polite"
              contentContainerStyle={{ alignItems: "flex-end", gap: 6, paddingLeft: 18, paddingRight: 12, paddingTop: 12 }}
            >
              {chips.length
                ? chips.map((x) => <Chip key={x.k} label={x.label} warn={!!x.warn} />)
                : STARTERS.map((w) => <Chip key={w} label={w} onPress={() => add(w)} />)}
            </ScrollView>
          </Animated.View>
          <View style={{ height: BAR_H, flexDirection: "row", alignItems: "center", paddingLeft: 22, paddingRight: 6 }}>
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              onFocus={() => {
                setFocused(true);
                onActiveChange?.(true);
              }}
              onBlur={onBlur}
              onSubmitEditing={() => void submit()}
              submitBehavior="submit"
              returnKeyType="done"
              editable={!saving}
              placeholder={focused ? example : `${md(date)}에 추가`}
              placeholderTextColor={c.muted}
              accessibilityLabel={`${md(date)}에 일정 빠르게 추가`}
              accessibilityHint="날짜, 시간, 인원, 제목을 한 줄로 적으면 알아서 나눠요"
              style={{ flex: 1, fontSize: 16, color: c.text, paddingVertical: 12 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ busy: saving, disabled: focused && !ready }}
              disabled={saving || (!!draft && !ready) || (focused && !draft)}
              onPress={() => void submit()}
              hitSlop={6}
            >
              {({ pressed }) => (
                <Animated.View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed && tintTo === 0 ? c.fill : btnBg,
                  }}
                >
                  {/* + turns into the check with a quarter turn; spinner swaps in the same way. */}
                  <Swap key={glyph}>
                    {glyph === "spin" ? (
                      <ActivityIndicator color={c.onPrimary} />
                    ) : glyph === "check" ? (
                      <Icon name="check" size={22} color={ready ? c.onPrimary : c.muted} />
                    ) : (
                      <Icon name="add" size={26} color={c.text} />
                    )}
                  </Swap>
                </Animated.View>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** A chip in the card's row: tappable starter, or a read-only "understood" chip that pops in. */
function Chip({ label, warn, onPress }: { label: string; warn?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    timeTo(v, 1, DUR.open, EASE_OUT);
  }, [v]);
  const body = (
    <Animated.View
      style={{
        paddingHorizontal: 12,
        height: 30,
        justifyContent: "center",
        borderRadius: radius.pill,
        backgroundColor: onPress ? c.subtle : c.card,
        borderWidth: onPress ? 0 : 1,
        borderColor: c.outline,
        opacity: v,
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      }}
    >
      <T variant="caption" color={warn ? c.danger : onPress ? c.text : c.text2} style={{ fontWeight: "600" }}>
        {label}
      </T>
    </Animated.View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`'${label}' 넣기`} onPress={onPress} hitSlop={{ top: 8, bottom: 8 }}>
      {body}
    </Pressable>
  );
}

/** Glyph swapping inside the button: a quarter turn + fade in, like + rotating into the check. */
function Swap({ children }: { children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    timeTo(v, 1, DUR.open, EASE_OUT);
  }, [v]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
