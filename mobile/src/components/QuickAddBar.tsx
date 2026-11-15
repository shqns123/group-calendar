import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, Keyboard, Platform, Pressable, ScrollView, TextInput, View, type KeyboardEvent } from "react-native";
import { api, ApiError, errorMessage } from "@/lib/api";
import { parseKey, keyToIso, type DateKey } from "@/lib/date";
import { choose, notice, type DialogRow } from "@/lib/confirm";
import { DUR, EASE_IN, EASE_OUT, timeTo } from "@/lib/motion";
import { parseQuickAdd } from "@/lib/quickAdd";
import { speechSupported, useSpeech, type SpeechFailure } from "@/lib/speech";
import { myLabel, rosterOf, useSession } from "@/lib/session";
import type { AiDraft, EventInput } from "@/lib/types";
import { invalidate } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { EVENT_COLORS, radius } from "@/theme/tokens";
import { AiAura, GLOW_MARGIN } from "./AiGlow";
import { Icon } from "./Icon";
import { T } from "./ui";

const md = (k: DateKey) => `${parseKey(k).month}월 ${parseKey(k).day}일`;
/** Pill height (closed) = the input row of the open card. */
export const QUICK_ADD_H = 52;

/** Bar color for an event added from the quick add bar: any of the palette, picked at random. */
function randomColor() {
  return EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)].hex;
}
const BAR_H = QUICK_ADD_H;
/** Extra height of the open card: the chip row above the input. */
const ROW_H = 44;
/** Default: how far the open card widens past the pill on each side. */
const WIDEN = 8;
/** Space kept between the card and the top of the keyboard. */
const KEYBOARD_GAP = 8;
/** Card corner radius for a card height: a full pill when closed, 24 when open. */
const cardRadius = (h: number) => {
  const t = Math.max(0, Math.min(1, (h - BAR_H) / ROW_H));
  return BAR_H / 2 + t * (24 - BAR_H / 2);
};
/** AI mode survives the bar being remounted (tab switches) while the app runs. */
let lastAiMode = false;

/**
 * Samsung-style quick add (month view and day popup). Type one line ("20~22일 광주 출장 김민수
 * 최유진", "내일 월휴", "오전 9시 회의") and it picks out the dates, time, people and title.
 *
 * Two readers: the on-device rule parser fills the chips while typing, and the check saves its
 * draft. With AI mode on (the sparkle button, `aiToggle` hosts only), the check instead asks the
 * server's AI reader (POST /api/events/parse), which copes with typos and loose phrasing
 * ("이틀ㄷ ㅢ 광주 출장", "3일뒤 일주일간 광주출장"); its reading replaces the chips and a second
 * check saves it. If the AI can't answer, the rule parser's draft is saved as before. AI mode
 * wears a slowly turning pastel ring and glow around the card.
 *
 * Voice: the mic button listens (phone's own Korean speech recognizer). Words appear in the field
 * as they're heard; when the person stops, the keyboard opens on the text so it can be fixed, and
 * the AI reading runs by itself. The check then saves it, as with typing.
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
  surface,
  fill,
  aiToggle = false,
}: {
  date: DateKey;
  tone?: "float" | "inset";
  /** How far the open card grows past the pill on each side (a narrow pill opens up wide). */
  widen?: number;
  /** Typing mode on/off — the host lays a tap-to-dismiss layer over everything else while on. */
  onActiveChange?: (active: boolean) => void;
  /** Pill/card color when it floats over a page with its own palette (e.g. the dark calendar). */
  surface?: string;
  /**
   * Fill the parent (which the host stretches over the whole screen) instead of taking a pill-high
   * box, so the card lifted over the keyboard stays inside its parent: Android only delivers taps
   * inside a parent's bounds, and outside them taps in the field (moving the cursor) got lost.
   */
  fill?: boolean;
  /** Show the AI-mode button; only then can the AI reader be used. */
  aiToggle?: boolean;
}) {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const { group, me } = useSession();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  // AI reading for exactly this text (stale as soon as the text changes).
  const [ai, setAi] = useState<{ text: string; draft: AiDraft } | null>(null);
  const [asking, setAsking] = useState(false);
  // AI mode is opt-in per tap of the sparkle button; remembered while the app runs.
  const [aiPicked, setAiPicked] = useState(lastAiMode);
  const aiMode = aiToggle && aiPicked;
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const roster = useMemo(() => rosterOf(group), [group]);


  const draft = useMemo(() => (text.trim() ? parseQuickAdd(text, date, roster) : null), [text, date, roster]);
  const aiNow = ai && ai.text === text ? ai.draft : null;
  // AI mode: any line can go to the AI, but its own reading must be clear before saving.
  // Rule mode: the line needs a title (근태 words are their own title).
  const ready = aiNow ? aiNow.status === "ok" : aiMode ? !!draft : !!draft && (draft.category === "ATTENDANCE" || !!draft.title);
  const busy = saving || asking;


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
        timeTo(lift, over > 0 ? -over : 0, dur, EASE_OUT, false);
      });
    };
    const drop = () => {
      timeTo(lift, 0, DUR.keyboard, EASE_OUT, false);
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
    timeTo(lift, 0, DUR.keyboard, EASE_OUT, false);
  }

  // --- Button: 0 = clear (+), 1 = gray (check, not ready), 2 = accent (check/+, ready).
  const [tint] = useState(() => new Animated.Value(0));

  async function save(body: EventInput) {
    setSaving(true);
    // Put the input away first (card → pill, keyboard down) …
    onBlur();
    input.current?.blur();
    Keyboard.dismiss();
    try {
      await Promise.all([api("/api/events", { method: "POST", body }), new Promise((r) => setTimeout(r, DUR.keyboard))]);
      // … then the result lands on the calendar.
      setText("");
      setAi(null);
      invalidate();
    } catch (e) {
      notice("추가하지 못했어요", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // Same rule as the full form: nobody picked → trips default to the writer on the server,
  // 근태 is recorded for the writer.
  const personnelFor = (category: EventInput["category"], people: string[]) =>
    people.length ? people.join(", ") : category === "ATTENDANCE" ? myLabel(group, me) : null;

  function saveRule(d = draft) {
    if (!group || !d) return;
    if (d.category !== "ATTENDANCE" && !d.title) {
      notice("제목을 적어 주세요", "어디로 가는지, 무슨 일인지 함께 적어 주세요.");
      return;
    }
    void save({
      category: d.category,
      title: d.title,
      description: d.time ? `시간 ${d.time}` : "",
      startDate: keyToIso(d.start),
      endDate: keyToIso(d.end),
      allDay: true,
      color: randomColor(),
      groupId: group.id,
      personnel: personnelFor(d.category, d.people),
      equipment: null,
      equipmentOnly: false,
    });
  }

  function saveAi(d: AiDraft) {
    if (!group) return;
    void save({
      category: d.category,
      title: d.title,
      description: [d.time ? `시간 ${d.time}` : null, d.detail || null].filter(Boolean).join(" · "),
      startDate: keyToIso(d.startDate),
      endDate: keyToIso(d.endDate),
      allDay: true,
      color: randomColor(),
      groupId: group.id,
      personnel: personnelFor(d.category, d.people),
      equipment: null,
      equipmentOnly: false,
    });
  }

  async function submit() {
    if (!draft) {
      router.push({ pathname: "/event/edit", params: { date } });
      return;
    }
    if (!group || busy) return;
    // Rule mode: save what the chips show, as before.
    if (!aiMode) {
      saveRule();
      return;
    }
    // AI mode: read the line (or use the reading already on screen), then confirm in a popup.
    await readAndConfirm(text, aiNow);
  }

  /**
   * AI mode: read `line` (unless `known` is already its reading) and put the result in the
   * confirm popup. Used by the check button and right after voice input.
   */
  async function readAndConfirm(line: string, known: AiDraft | null = null) {
    const reading = known ?? (await askAi(line));
    if (reading === "failed") {
      // AI unavailable: show the rule parser's reading in the same popup instead.
      const rule = line.trim() ? parseQuickAdd(line, date, roster) : null;
      if (rule) void confirmDraft(ruleView(rule), "AI를 쓸 수 없어 기본 해석으로 보여 드려요.");
      return;
    }
    if (!reading) return;
    if (reading.status === "unclear") {
      notice("일정으로 읽지 못했어요", `${reading.note || "날짜나 할 일을 조금 더 적어 주세요."}\n문장을 고쳐 다시 눌러 주세요.`);
      return;
    }
    void confirmDraft(aiView(reading));
  }

  /** One shape for both readers, for the confirm popup and the edit form. */
  type DraftView = {
    category: EventInput["category"];
    title: string;
    detail: string;
    start: DateKey;
    end: DateKey;
    time: string | null;
    people: string[];
    unknownPeople: string[];
    save: () => void;
  };
  const aiView = (d: AiDraft): DraftView => ({
    category: d.category,
    title: d.title,
    detail: d.detail,
    start: d.startDate,
    end: d.endDate,
    time: d.time,
    people: d.people,
    unknownPeople: d.unknownPeople,
    save: () => saveAi(d),
  });
  const ruleView = (d: NonNullable<typeof draft>): DraftView => ({
    category: d.category,
    title: d.title,
    detail: "",
    start: d.start,
    end: d.end,
    time: d.time,
    people: d.people,
    unknownPeople: [],
    save: () => saveRule(d),
  });

  /** "이대로 추가할까요?" popup: 추가 saves, 수정 opens the full form filled in, 취소 keeps the line. */
  async function confirmDraft(v: DraftView, message?: string) {
    // Keyboard and card out of the way while the popup is up.
    input.current?.blur();
    Keyboard.dismiss();
    const days = Math.round((Date.parse(v.end) - Date.parse(v.start)) / 86_400_000) + 1;
    const rows: DialogRow[] = [
      { label: "종류", value: v.category === "ATTENDANCE" ? `근태 · ${v.title}${v.detail && v.detail !== v.title ? ` (${v.detail})` : ""}` : "출장" },
      ...(v.category === "ATTENDANCE" ? [] : [{ label: "제목", value: v.title || "제목 없음", warn: !v.title }]),
      { label: "날짜", value: v.start === v.end ? md(v.start) : `${md(v.start)} – ${md(v.end)} (${days}일)` },
      ...(v.time ? [{ label: "시간", value: v.time }] : []),
      {
        label: "인원",
        value: v.people.length ? v.people.join(", ") : v.category === "ATTENDANCE" ? `${myLabel(group, me)} (나)` : "지정 안 함",
      },
      ...(v.unknownPeople.length ? [{ label: "확인", value: `${v.unknownPeople.join(", ")} 님은 그룹에 없어요`, warn: true }] : []),
    ];
    const picked = await choose("이대로 추가할까요?", rows, [
      { key: "edit", label: "수정" },
      { key: "add", label: "추가", strong: true },
    ], message);
    if (picked === "add") v.save();
    else if (picked === "edit") openForm(v);
  }

  /** The full event form, filled in from the reading, for anything the line can't express. */
  function openForm(v: DraftView) {
    const description = [v.time ? `시간 ${v.time}` : null, v.detail || null].filter(Boolean).join(" · ");
    const draftParam = JSON.stringify({ category: v.category, title: v.title, start: v.start, end: v.end, people: v.people, description });
    setText("");
    setAi(null);
    router.push({ pathname: "/event/edit", params: { date: v.start, draft: draftParam } });
  }

  /**
   * Ask the AI reader about `asked` and show its reading as chips. Returns the reading, null when
   * the login is gone (reported here), or "failed" when the AI can't answer (no key, limit,
   * timeout, offline, or a server without this route yet), so the caller can use the rule parser.
   */
  async function askAi(asked: string): Promise<AiDraft | null | "failed"> {
    if (!group) return null;
    setAsking(true);
    try {
      const res = await api<{ draft: AiDraft }>("/api/events/parse", { method: "POST", body: { groupId: group.id, text: asked, date } });
      setAi({ text: asked, draft: res.draft });
      return res.draft;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        notice("다시 로그인해 주세요", errorMessage(e));
        return null;
      }
      return "failed";
    } finally {
      setAsking(false);
    }
  }

  const speech = useSpeech(
    (heard) => {
      setText(heard);
      setAi(null);
    },
    (heard, failure) => {
      if (heard) {
        setText(heard);
        // AI mode: straight to the confirm popup (수정 opens the full form to fix anything).
        // Otherwise keyboard up on the transcript to fix a misheard word, then check to save.
        if (aiMode) void readAndConfirm(heard);
        else input.current?.focus();
        return;
      }
      const why: Record<SpeechFailure, [string, string]> = {
        permission: ["마이크 권한이 필요해요", "휴대폰 설정에서 그룹 캘린더 앱의 마이크 권한을 허용해 주세요."],
        unavailable: ["음성 인식을 쓸 수 없어요", "이 폰에 음성 인식 서비스(Google 앱)가 없거나 꺼져 있어요."],
        "no-speech": ["잘 듣지 못했어요", "마이크를 누르고 또박또박 말해 주세요. 예: 내일 광주 출장"],
        error: ["음성 인식이 멈췄어요", "잠시 후 다시 해 주세요."],
      };
      if (failure) notice(...why[failure]);
    },
  );
  const listening = speech.listening;
  // The card is open while typing or listening.
  const expanded = focused || listening;

  // --- Pill ⇄ card. Layout props (height/insets) → JS driver. `open` widens the card;
  // `rowIn` adds the chip row's height on top only when there are chips to show.
  const [open] = useState(() => new Animated.Value(0));
  const [rowIn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (expanded) timeTo(open, 1, 200, EASE_OUT, false);
    else timeTo(open, 0, 90, EASE_IN, false);
  }, [expanded, open]);

  function toggleAi() {
    if (busy) return;
    const next = !aiPicked;
    lastAiMode = next;
    setAiPicked(next);
    setAi(null);
    input.current?.focus();
  }

  // AI mode border: fades in/out; its bulge runs only while AI mode is on.
  const [aiShow] = useState(() => new Animated.Value(aiMode ? 1 : 0));
  useEffect(() => {
    timeTo(aiShow, aiMode ? 1 : 0, aiMode ? DUR.open : DUR.close, aiMode ? EASE_OUT : EASE_IN, false);
  }, [aiMode, aiShow]);

  function toggleMic() {
    if (listening) {
      speech.stop();
      return;
    }
    if (busy) return;
    // Listen without the keyboard in the way; the card stays open while listening.
    input.current?.blur();
    Keyboard.dismiss();
    setAi(null);
    void speech.start();
  }

  const tintTo = busy || ready ? 2 : expanded ? 1 : 0;
  useEffect(() => {
    timeTo(tint, tintTo, DUR.swap, EASE_OUT, false);
  }, [tint, tintTo]);


  // --- Chip row: what was understood (the AI reading once asked); empty until something is typed.
  const chips: { k: string; label: string; warn?: boolean; accent?: boolean }[] = aiNow
    ? aiNow.status === "unclear"
      ? [
          { k: "ai", label: "AI", accent: true },
          { k: "note", label: aiNow.note || "일정으로 읽지 못했어요", warn: true },
        ]
      : [
          { k: "ai", label: "AI", accent: true },
          { k: "date", label: aiNow.startDate === aiNow.endDate ? md(aiNow.startDate) : `${md(aiNow.startDate)} – ${md(aiNow.endDate)}` },
          ...(aiNow.time ? [{ k: "time", label: aiNow.time }] : []),
          aiNow.category === "ATTENDANCE"
            ? { k: "kind", label: `근태 · ${aiNow.title}${aiNow.detail && aiNow.detail !== aiNow.title ? ` (${aiNow.detail})` : ""}` }
            : { k: "kind", label: `출장 · ${aiNow.title}` },
          ...(aiNow.people.length ? [{ k: "people", label: aiNow.people.join(", ") }] : []),
          ...aiNow.unknownPeople.map((n, i) => ({ k: `unknown-${i}`, label: `${n} 님 없음`, warn: true })),
        ]
    : draft
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

  // The chip row only takes room while there's something in it.
  const hasRow = expanded && (chips.length > 0 || (listening && !text));
  useEffect(() => {
    if (hasRow) timeTo(rowIn, 1, DUR.open, EASE_OUT, false);
    else timeTo(rowIn, 0, DUR.close, EASE_IN, false);
  }, [hasRow, rowIn]);

  const inset = tone === "inset";
  const example = `예: 내일 오전 9시 광주 출장 ${roster[0] ?? "김민수"}`;
  const btnBg = tint.interpolate({ inputRange: [0, 1, 2], outputRange: [`${c.fill}00`, c.fill, c.primary] });
  const glyph = busy ? "spin" : focused || ready ? "check" : "add";
  const label = saving
    ? "추가하는 중"
    : asking
      ? "AI가 읽는 중"
      : aiNow
        ? aiNow.status === "ok"
          ? "확인하고 추가"
          : "다시 적어 주세요"
        : draft
          ? aiMode
            ? "AI로 읽기"
            : "추가"
          : focused
            ? "추가할 내용을 적어 주세요"
            : "자세히 입력";

  return (
    // The box reaches up over the chip row (it only takes BAR_H of layout space): Android ignores
    // touches outside a view's bounds, so a row drawn above a pill-high box could be seen but not
    // swiped. Its empty part lets taps through to what's underneath.
    <View ref={anchor} collapsable={false} pointerEvents="box-none" style={fill ? { flex: 1 } : { height: BAR_H + ROW_H, marginTop: -ROW_H }}>
      {/* Lifted over the keyboard by layout (top/bottom), not a transform: Android hit-tests a
          view outside its parent only within the parent's layout overflow, which ignores
          transforms, so a translated card could be seen but not tapped (no cursor moves, chips
          or check). JS driver, since these are layout props. */}
      <Animated.View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: lift, bottom: Animated.multiply(lift, -1) }}>
        {/* AI mode: a thin multicolor ring just outside the card (in a box GLOW_MARGIN larger on
            every side), turning slowly. */}
        {aiToggle ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -GLOW_MARGIN,
              left: open.interpolate({ inputRange: [0, 1], outputRange: [-GLOW_MARGIN, -widen - GLOW_MARGIN] }),
              right: open.interpolate({ inputRange: [0, 1], outputRange: [-GLOW_MARGIN, -widen - GLOW_MARGIN] }),
              height: rowIn.interpolate({ inputRange: [0, 1], outputRange: [BAR_H + 2 * GLOW_MARGIN, BAR_H + ROW_H + 2 * GLOW_MARGIN] }),
              opacity: aiShow,
            }}
          >
            <AiAura on={aiMode} radius={cardRadius} />
          </Animated.View>
        ) : null}
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: open.interpolate({ inputRange: [0, 1], outputRange: [0, -widen] }),
            right: open.interpolate({ inputRange: [0, 1], outputRange: [0, -widen] }),
            height: rowIn.interpolate({ inputRange: [0, 1], outputRange: [BAR_H, BAR_H + ROW_H] }),
            borderRadius: rowIn.interpolate({ inputRange: [0, 1], outputRange: [BAR_H / 2, 24] }),
            overflow: "hidden",
            justifyContent: "flex-end",
            backgroundColor: inset && !expanded ? c.subtle : (surface ?? c.card),
            shadowColor: "#0F172A",
            // In AI mode the glow stands in for the shadow (Android draws its shadow over a halo).
            shadowOpacity: aiMode || (inset && !expanded) ? 0 : isDark ? 0.5 : expanded ? 0.16 : 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: aiMode || (inset && !expanded) ? 0 : 6,
          }}
        >
          {/* Chip row: fades in once the card has grown (content after container). */}
          <Animated.View style={{ height: ROW_H, opacity: rowIn.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }) }}>
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              // Android: fade the edge that has more chips, as a hint the row scrolls sideways.
              fadingEdgeLength={24}
              showsHorizontalScrollIndicator={false}
              accessibilityLiveRegion="polite"
              contentContainerStyle={{ alignItems: "flex-end", gap: 6, paddingLeft: 18, paddingRight: 12, paddingTop: 12 }}
            >
              {listening && !text
                ? [<Chip key="listen" label="듣고 있어요. 말을 마치면 멈춰요" accent />]
                : chips.map((x) => <Chip key={x.k} label={x.label} warn={!!x.warn} accent={!!x.accent} />)}
            </ScrollView>
          </Animated.View>
          <View style={{ height: BAR_H, flexDirection: "row", alignItems: "center", paddingLeft: aiToggle ? 6 : 22, paddingRight: 6 }}>
            {aiToggle ? <AiButton on={aiMode} disabled={busy} onPress={toggleAi} /> : null}
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
              editable={!busy}
              placeholder={listening ? "말씀하세요" : aiMode ? (focused ? "편하게 적어 주세요 (예: 3일뒤 일주일간 광주출장)" : "AI로 일정 추가") : focused ? example : `${md(date)}에 추가`}
              placeholderTextColor={c.muted}
              accessibilityLabel={`${md(date)}에 일정 빠르게 추가`}
              accessibilityHint="날짜, 시간, 인원, 제목을 한 줄로 적으면 알아서 나눠요"
              style={{ flex: 1, fontSize: 16, color: c.text, paddingVertical: 12 }}
            />
            {speechSupported ? <MicButton listening={listening} disabled={busy} onPress={toggleMic} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ busy, disabled: focused && !ready }}
              disabled={busy || (!!draft && !ready) || (focused && !draft)}
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

/** AI mode on/off. On: the sparkle alone lights up (filled, larger, brand color), no background. */
function AiButton({ on, disabled, onPress }: { on: boolean; disabled: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="AI로 읽기"
      accessibilityHint="켜면 대충 적어도 AI가 날짜, 인원, 출장지를 알아서 정리해요"
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{ marginRight: 6 }}
    >
      {({ pressed }) => (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            // No disc behind it: on, only the icon lights up (bigger, filled, brand color).
            opacity: pressed ? 0.6 : 1,
          }}
        >
          <Icon name="sparkles" size={on ? 24 : 21} color={on ? c.primary : disabled ? c.muted : c.text2} filled={on} />
        </View>
      )}
    </Pressable>
  );
}

/** Mic: tap to speak, tap again to stop. While listening the icon alone turns red and breathes. */
function MicButton({ listening, disabled, onPress }: { listening: boolean; disabled: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!listening) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listening ? "듣기 멈추기" : "말로 입력"}
      accessibilityHint={listening ? undefined : "날짜, 인원, 할 일을 말하면 글자로 적어 드려요"}
      accessibilityState={{ disabled, busy: listening }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{ marginRight: 4 }}
    >
      {({ pressed }) => (
        // No disc behind it: while listening only the icon lights up (filled, larger, red) and
        // breathes gently, like the AI button.
        <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 }}>
          <Animated.View
            style={
              listening
                ? {
                    opacity: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.55, 1] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] }) }],
                  }
                : null
            }
          >
            <Icon name="mic" size={listening ? 25 : 22} color={listening ? c.danger : disabled ? c.muted : c.text2} filled={listening} />
          </Animated.View>
        </View>
      )}
    </Pressable>
  );
}

/** A chip in the card's row: tappable starter, or a read-only "understood" chip that pops in. */
function Chip({ label, warn, accent, onPress }: { label: string; warn?: boolean; accent?: boolean; onPress?: () => void }) {
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
        backgroundColor: accent ? c.primaryContainer : onPress ? c.subtle : c.card,
        borderWidth: onPress || accent ? 0 : 1,
        borderColor: c.outline,
        opacity: v,
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      }}
    >
      <T variant="caption" color={warn ? c.danger : accent ? c.onPrimaryContainer : onPress ? c.text : c.text2} style={{ fontWeight: "600" }}>
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
