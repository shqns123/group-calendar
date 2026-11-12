import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { ErrorBanner, IconButton, Loading, T, Tag } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { eventsOn } from "@/lib/calendar";
import { addDays, dotted, keyToIso, longLabel, parseKey, todayKey, toKey, WEEKDAYS_LONG, weekday, type DateKey } from "@/lib/date";
import { equipmentFor, personnelFor, splitList } from "@/lib/roster";
import { holidayInfo } from "@/lib/holidays";
import { permissionsFor } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { useHolidays } from "@/lib/useHolidays";
import type { CalEvent, DayNote, PersonalNoteItem } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { HIT, radius } from "@/theme/tokens";

/** Event color as a soft card background (hex only; anything else falls back to the card color). */
function tint(color: string, alpha: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(color ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const OPEN_INSET = 12;

const monthDay = (key: DateKey) => `${parseKey(key).month}월 ${parseKey(key).day}일`;

/** Popup route: the day detail floating over the calendar (phones / folded screen). */
export default function DaySheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const date: DateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey();
  return <DayDetail date={date} onChangeDate={(d) => router.setParams({ date: d })} />;
}

/**
 * The selected day's detail. As a popup (default) it floats over a light wash; with `inline`
 * it fills the right pane of the unfolded (wide) layout instead.
 */
export function DayDetail({ date, onChangeDate, inline }: { date: DateKey; onChangeDate: (d: DateKey) => void; inline?: boolean }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { group, me } = useSession();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  // Personnel chips in the header: which list is open, and the drop-down animation.
  type PeekKey = "ot" | "left" | "eq";
  const [peek, setPeek] = useState<PeekKey | null>(null);
  const [shown, setShown] = useState<PeekKey | null>(null);
  const [peekAnim] = useState(() => new Animated.Value(0));
  // Geometry for "the chip itself stretches open" (header coordinates).
  type Box = { x: number; y: number; w: number; h: number };
  const [chipBoxes, setChipBoxes] = useState<Partial<Record<PeekKey, Box>>>({});
  const [chipRow, setChipRow] = useState<Box | null>(null);
  const [headerW, setHeaderW] = useState(0);
  const [openH, setOpenH] = useState(0);
  // JS driver: position, size and corner radius are layout props (native driver can't).
  const grow = (to: 0 | 1, done?: () => void) =>
    Animated.timing(peekAnim, { toValue: to, duration: to ? 320 : 220, easing: to ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (finished) done?.();
    });
  const openPeek = (k: PeekKey) => {
    setPeek(k);
    setShown(k);
    peekAnim.setValue(0);
    grow(1);
  };
  const closePeek = () => {
    if (!peek) return;
    setPeek(null);
    grow(0, () => setShown(null));
  };

  const { data: events, error, refresh } = useData(group ? `day:${group.id}:${date}` : null, () =>
    api<CalEvent[]>("/api/events", { query: { groupId: group!.id, start: keyToIso(date), end: keyToIso(date) } }),
  );
  const { data: note } = useData(group ? `note:${group.id}:${date}` : null, () =>
    api<{ note: DayNote }>("/api/day-notes", { query: { groupId: group!.id, date } }),
  );

  const { data: personal } = useData(`personal:${date}`, () => api<{ note: { items?: PersonalNoteItem[] } | null }>("/api/personal-notes", { query: { date } }));
  const holidays = useHolidays();

  const day = events ? eventsOn(events, date) : [];
  const work = day.filter((e) => !e.isOvertimeOnly);
  const mine = day.find((e) => e.isOvertimeOnly && e.creatorId === me?.id);
  const otState: "yes" | "no" | "none" = mine ? (mine.overtimeAvailable ? "yes" : "no") : "none";
  const people = personnelFor(group, day);
  const eq = equipmentFor(group, day);

  async function clearOvertime() {
    if (!group) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api("/api/overtime-status", { method: "DELETE", query: { groupId: group.id, date } });
      invalidate();
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function setOvertime(available: boolean) {
    if (!group) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api("/api/events", {
        method: "POST",
        body: { isOvertimeOnly: true, overtimeAvailable: available, title: "특근", startDate: keyToIso(date), endDate: keyToIso(date), allDay: true, groupId: group.id, category: "BUSINESS_TRIP" },
      });
      invalidate();
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const otText = otState === "yes" ? "가능" : otState === "no" ? "불가능" : "아직 표시 안 했어요";
  const otColor = otState === "yes" ? c.onWarn : otState === "no" ? c.offText : c.onWarn;
  const noteItems = (note?.note?.items ?? []) as { text: string; assignee?: string; startDate?: string; endDate?: string }[];
  const p = permissionsFor(group, me);
  const hol = holidayInfo(date, holidays);
  const personalItems = personal?.note?.items ?? [];
  const eqItems = [
    ...(eq.trackers.length ? [`트래커 ${eq.trackerRemaining}/${eq.trackers.length}`] : []),
    ...(eq.laptops.length ? [`노트북 ${eq.laptopRemaining}/${eq.laptops.length}`] : []),
    ...(eq.targetTotal ? [`타겟 ${eq.targetRemaining}/${eq.targetTotal}`] : []),
  ];
  type Section = { label?: string; items: string[]; fg: string };
  const groups = {
    ot: { key: "ot" as const, label: "특근 가능", count: people.overtime.length as number | null, bg: c.warnContainer, fg: c.onWarn, note: `전체 ${people.total}명 중`,
      sections: [
        { label: "가능", items: people.overtime, fg: c.onWarn },
        { label: "불가능", items: people.overtimeNo, fg: c.danger },
      ] as Section[] },
    left: { key: "left" as const, label: "남은 인원", count: people.remaining.length as number | null, bg: c.okContainer, fg: c.onOk, note: "출장·근태 제외", sections: [{ items: people.remaining, fg: c.onOk }] as Section[] },
    eq: { key: "eq" as const, label: "장비 잔여", count: null as number | null, bg: c.infoContainer, fg: c.onInfo, note: "남은 수 / 전체", sections: [{ items: eqItems, fg: c.onInfo }] as Section[] },
  };
  const chips = [groups.ot, groups.left, ...(eqItems.length ? [groups.eq] : [])];
  const panel = shown ? groups[shown] : null;
  // Where the shown chip sits in the header; the open box starts there.
  const shownBox = shown ? chipBoxes[shown] : undefined;
  const grown =
    shownBox && chipRow && headerW
      ? { x: chipRow.x + shownBox.x, y: chipRow.y + shownBox.y, w: shownBox.w, h: shownBox.h, openW: headerW - OPEN_INSET * 2 }
      : null;

  return (
    <View
      style={
        inline
          ? { flex: 1, padding: 16, paddingTop: insets.top + 8, backgroundColor: c.bg }
          : { flex: 1, paddingHorizontal: 16, paddingTop: insets.top + 56, paddingBottom: Math.max(insets.bottom - 10, 16) }
      }
    >
      {/* Light wash over the calendar (it stays faintly visible behind the card); tap to close. */}
      {inline ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={() => router.back()}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(246,247,249,0.78)" }}
        />
      )}
      <View
        accessibilityViewIsModal={!inline}
        style={{
          flex: 1,
          backgroundColor: c.sheet,
          borderRadius: radius.sheet,
          overflow: "hidden",
          shadowColor: "#0F172A",
          shadowOpacity: isDark ? 0.5 : 0.16,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
      <View onLayout={(e) => setHeaderW(e.nativeEvent.layout.width)} style={{ zIndex: 3, backgroundColor: c.subtle, paddingTop: 18, paddingBottom: 12, paddingLeft: 24, paddingRight: 8, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Pressable
            onPress={peek ? closePeek : undefined}
            style={{ flex: 1, flexDirection: "row", alignItems: "baseline", gap: 10 }}
            accessible
            accessibilityRole="header"
            accessibilityLabel={longLabel(date)}
          >
            <T variant="title1" style={{ fontSize: 34, lineHeight: 40 }} color={hol.holiday || weekday(date) === 0 ? c.sunday : weekday(date) === 6 ? c.saturday : c.text}>
              {String(parseKey(date).day)}
            </T>
            <T variant="headline" style={{ fontSize: 18 }} color={c.text}>
              {WEEKDAYS_LONG[weekday(date)]}
            </T>
          </Pressable>
          <IconButton icon="back" tone="plain" label={`이전 날, ${longLabel(addDays(date, -1))}`} onPress={() => { closePeek(); onChangeDate(addDays(date, -1)); }} />
          <IconButton icon="forward" tone="plain" label={`다음 날, ${longLabel(addDays(date, 1))}`} onPress={() => { closePeek(); onChangeDate(addDays(date, 1)); }} />
        </View>

        {/* 인원 현황 chips: tap one to drop its list down; tap anywhere else to close. */}
        {events ? (
          <View
            onLayout={(e) => {
              const l = e.nativeEvent.layout;
              setChipRow({ x: l.x, y: l.y, w: l.width, h: l.height });
            }}
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginLeft: -8 }}
          >
            {chips.map((ch) => {
              const on = peek === ch.key;
              return (
                <Pressable
                  key={ch.key}
                  onLayout={(e) => {
                    const l = e.nativeEvent.layout;
                    setChipBoxes((b) => ({ ...b, [ch.key]: { x: l.x, y: l.y, w: l.width, h: l.height } }));
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: on }}
                  accessibilityLabel={`${ch.label}${ch.count != null ? ` ${ch.count}` : ""}`}
                  onPress={() => (on ? closePeek() : openPeek(ch.key))}
                  style={({ pressed }) => ({
                    minHeight: 32,
                    paddingLeft: 12,
                    paddingRight: 10,
                    borderRadius: radius.pill,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: on ? ch.bg : c.card,
                    opacity: shown === ch.key ? 0 : pressed ? 0.8 : 1,
                  })}
                >
                  <T variant="footnote" color={ch.fg} style={{ fontSize: 13 }}>
                    {ch.label}
                  </T>
                  {ch.count != null ? (
                    <T variant="footnote" color={ch.fg} style={{ fontSize: 13, fontWeight: "700" }}>
                      {String(ch.count)}
                    </T>
                  ) : null}
                  <View style={{ transform: [{ rotate: on ? "180deg" : "0deg" }] }}>
                    <Icon name="down" size={14} color={ch.fg} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* The tapped chip stretches (left/width/height/corners) into a box; its own label
            stays on top and the list appears inside it. Reverse on close. */}
        {panel && grown ? (
          <Animated.View
            accessibilityLiveRegion="polite"
            style={{
              position: "absolute",
              left: peekAnim.interpolate({ inputRange: [0, 1], outputRange: [grown.x, OPEN_INSET] }),
              top: grown.y,
              width: peekAnim.interpolate({ inputRange: [0, 1], outputRange: [grown.w, grown.openW] }),
              height: peekAnim.interpolate({ inputRange: [0, 1], outputRange: [grown.h, Math.max(grown.h, openH)] }),
              borderRadius: peekAnim.interpolate({ inputRange: [0, 1], outputRange: [grown.h / 2, 18] }),
              backgroundColor: panel.bg,
              overflow: "hidden",
              shadowColor: "#0F172A",
              shadowOpacity: peekAnim.interpolate({ inputRange: [0, 1], outputRange: [0, isDark ? 0.5 : 0.16] }),
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            {/* Natural size of the open box, measured once at full width. */}
            <View onLayout={(e) => setOpenH(e.nativeEvent.layout.height)} style={{ position: "absolute", left: 0, top: 0, width: grown.openW }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: true }}
                accessibilityLabel={`${panel.label} 닫기`}
                onPress={closePeek}
                style={{ height: grown.h, paddingLeft: 12, paddingRight: 10, flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <T variant="footnote" color={panel.fg} style={{ fontSize: 13 }}>
                  {panel.label}
                </T>
                {panel.count != null ? (
                  <T variant="footnote" color={panel.fg} style={{ fontSize: 13, fontWeight: "700" }}>
                    {String(panel.count)}
                  </T>
                ) : null}
                <Animated.View style={{ transform: [{ rotate: peekAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
                  <Icon name="down" size={14} color={panel.fg} />
                </Animated.View>
                <View style={{ flex: 1 }} />
                <Animated.Text style={{ color: c.text2, fontSize: 12, fontWeight: "600", opacity: peekAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }) }}>
                  {panel.note}
                </Animated.Text>
              </Pressable>
              <Animated.View
                style={{
                  paddingHorizontal: 12,
                  paddingTop: 2,
                  paddingBottom: 14,
                  gap: 10,
                  opacity: peekAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
                }}
              >
                {/* 특근 chip lists both answers: 가능 and 불가능. Other chips have one list. */}
                {panel.sections.map((sec) => (
                  <View key={sec.label ?? "all"} style={{ gap: 6 }}>
                    {sec.label ? (
                      <T variant="caption" color={sec.fg} style={{ fontWeight: "700" }}>
                        {`${sec.label} ${sec.items.length}`}
                      </T>
                    ) : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {sec.items.length ? (
                        sec.items.map((n) => <Tag key={n} label={n} bg={c.card} fg={sec.fg} />)
                      ) : (
                        <T variant="footnote" color={c.muted}>
                          없음
                        </T>
                      )}
                    </View>
                  </View>
                ))}
              </Animated.View>
            </View>
          </Animated.View>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 8 }}>
        <T variant="footnote" color={hol.holiday ? c.sunday : c.text2} style={{ marginHorizontal: 8, marginBottom: 2, fontWeight: "400" }}>
          {[`${parseKey(date).month}월 ${parseKey(date).day}일`, hol.name ? (hol.workday ? `${hol.name} (근무일)` : hol.name) : null].filter(Boolean).join(" · ")}
        </T>
        {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
        {saveError ? <ErrorBanner message={saveError} /> : null}

        {p.canWriteEvents ? (
          // Not marked yet → amber card with an outline and a prompt, so it gets noticed.
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 52,
              paddingLeft: 18,
              paddingRight: 12,
              paddingVertical: otState === "none" ? 8 : 0,
              borderRadius: 16,
              backgroundColor: otState === "none" ? c.warnContainer : c.card,
              borderWidth: otState === "none" ? 1.5 : 0,
              borderColor: c.overtimeTrack,
            }}
          >
            {otState === "none" ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.overtimeTrack }} /> : null}
            <View style={{ flex: 1, flexDirection: otState === "none" ? "column" : "row", alignItems: otState === "none" ? "flex-start" : "baseline", gap: otState === "none" ? 2 : 8 }}>
              <T variant="subhead" color={otState === "none" ? c.onWarn : c.text} style={{ fontSize: 15, fontWeight: "600" }}>
                내 특근
              </T>
              <T variant="caption" color={otColor} style={{ fontSize: 12, fontWeight: "600" }}>
                {otText}
              </T>
            </View>
            {/* Pick one chip; nothing picked = not marked yet. */}
            <View accessibilityRole="radiogroup" accessibilityLabel="내 특근" style={{ flexDirection: "row", gap: 6 }}>
              {([
                { value: "no", label: "불가능", bg: c.dangerContainer, fg: c.danger },
                { value: "yes", label: "가능", bg: c.warnContainer, fg: c.onWarn },
              ] as const).map((o) => {
                const on = otState === o.value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="radio"
                    accessibilityLabel={`특근 ${o.label}`}
                    accessibilityState={{ checked: on, disabled: saving }}
                    disabled={saving}
                    hitSlop={6}
                    // Tapping the picked chip again clears the mark (back to 미표시).
                    onPress={() => void (on ? clearOvertime() : setOvertime(o.value === "yes"))}
                    style={({ pressed }) => ({
                      minHeight: 34,
                      paddingHorizontal: 14,
                      borderRadius: radius.pill,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: on ? o.bg : pressed ? c.fill : c.card,
                      borderWidth: on ? 1.5 : 1,
                      borderColor: on ? o.fg : c.outline,
                      opacity: saving && !on ? 0.6 : 1,
                    })}
                  >
                    <T variant="footnote" color={on ? o.fg : c.text2} style={{ fontWeight: "700" }}>
                      {o.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {!events ? <Loading /> : null}
        {events && work.length === 0 ? (
          <T variant="subhead" color={c.muted} style={{ marginHorizontal: 8, marginVertical: 8 }}>
            이 날은 일정이 없어요.
          </T>
        ) : null}
        {work.map((e) => {
          // Reference layout: title, people, date — nothing else.
          const s0 = toKey(e.startDate);
          const s1 = toKey(e.endDate);
          const range = s0 === s1 ? monthDay(s0) : `${monthDay(s0)} - ${monthDay(s1)}`;
          const persons = e.equipmentOnly ? [] : splitList(e.personnel);
          return (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${e.title}${range ? `, ${range}` : ""}${persons.length ? `, ${persons.join(" ")}` : ""}, 수정하기`}
              onPress={p.canWriteEvents ? () => router.push({ pathname: "/event/edit", params: { id: e.id, date } }) : undefined}
              style={({ pressed }) => ({
                flexDirection: "row",
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: radius.card,
                backgroundColor: tint(e.color, isDark ? 0.28 : 0.16) ?? c.card,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ paddingTop: 2 }}>
                <Icon name="calendar" size={20} color={e.color} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="subhead" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, fontWeight: "600" }}>
                  {e.title}
                </T>
                {persons.length ? (
                  <T variant="caption" color={c.text} numberOfLines={1} style={{ fontSize: 12, fontWeight: "400" }}>
                    {persons.join(", ")}
                  </T>
                ) : null}
                <T variant="caption" color={c.text2} style={{ fontSize: 12, fontWeight: "400" }}>
                  {range}
                </T>
              </View>
            </Pressable>
          );
        })}

        {/* 업무 메모 + 개인 메모 in one card; the header opens and closes it. */}
        <View style={{ backgroundColor: c.card, borderRadius: radius.card, overflow: "hidden" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: memoOpen }}
            accessibilityLabel={`메모, 업무 ${noteItems.length}개, 개인 ${personalItems.length}개`}
            onPress={() => setMemoOpen((v) => !v)}
            style={({ pressed }) => ({ minHeight: 52, paddingLeft: 20, paddingRight: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: pressed ? c.fill : "transparent" })}
          >
            <Icon name="note" size={18} color={c.text2} />
            <T variant="subhead" style={{ fontSize: 15, fontWeight: "600" }}>
              메모
            </T>
            <T variant="caption" color={c.text2} style={{ flex: 1 }}>
              {`업무 ${noteItems.length} · 개인 ${personalItems.length}`}
            </T>
            <View style={{ transform: [{ rotate: memoOpen ? "180deg" : "0deg" }] }}>
              <Icon name="down" size={20} color={c.text2} />
            </View>
          </Pressable>
          {memoOpen ? (
            <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 6 }}>
              {noteItems.length || p.canEditDayNote ? (
                <MemoCard
                  title="업무 메모"
                  tone="warn"
                  items={noteItems.map((i) => [i.text, i.assignee || null, i.startDate && i.endDate && i.startDate !== i.endDate ? `${dotted(i.startDate)} – ${dotted(i.endDate)}` : null].filter(Boolean).join(" · "))}
                  emptyText="이 날 업무 메모가 없어요."
                  onEdit={p.canEditDayNote ? () => router.push({ pathname: "/memo/edit", params: { date, kind: "group" } }) : undefined}
                />
              ) : null}
              <MemoCard
                title="개인 메모 (나만 보기)"
                tone="plain"
                items={personalItems.map((i) => i.text)}
                emptyText="메모를 남기면 나만 볼 수 있어요."
                onEdit={() => router.push({ pathname: "/memo/edit", params: { date, kind: "personal" } })}
              />
            </View>
          ) : null}
        </View>

      </ScrollView>

      {peek ? <Pressable accessibilityRole="button" accessibilityLabel="인원 목록 닫기" onPress={closePeek} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 }} /> : null}

      {p.canWriteEvents ? (
        <View style={{ paddingHorizontal: 28, paddingTop: 8, paddingBottom: 20 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${parseKey(date).month}월 ${parseKey(date).day}일에 일정 추가`}
            onPress={() => router.push({ pathname: "/event/edit", params: { date } })}
            style={({ pressed }) => ({
              minHeight: 56,
              borderRadius: radius.pill,
              paddingLeft: 24,
              paddingRight: 18,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: pressed ? c.fill : c.subtle,
            })}
          >
            <T variant="subhead" color={c.text2} style={{ flex: 1, fontSize: 16, fontWeight: "500" }}>
              {`${parseKey(date).month}월 ${parseKey(date).day}일에 추가`}
            </T>
            <Icon name="add" size={26} color={c.text} />
          </Pressable>
        </View>
      ) : null}
      </View>
    </View>
  );
}

function MemoCard({ title, tone, items, emptyText, onEdit }: { title: string; tone: "warn" | "plain"; items: string[]; emptyText: string; onEdit?: () => void }) {
  const { c } = useTheme();
  const warn = tone === "warn";
  const fg = warn ? c.onWarn : c.text;
  return (
    <View style={{ backgroundColor: warn ? c.warnContainer : c.subtle, borderRadius: radius.control, paddingLeft: 14, paddingRight: 4, paddingTop: 2, paddingBottom: 10, gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 40 }}>
        <T variant="caption" color={warn ? c.onWarn : c.text2} style={{ flex: 1, fontWeight: "700" }}>
          {title}
        </T>
        {onEdit ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${title} 편집`} onPress={onEdit} style={{ minHeight: HIT, minWidth: HIT, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" }}>
            <T variant="footnote" color={c.primaryText}>
              {items.length ? "편집" : "추가"}
            </T>
          </Pressable>
        ) : null}
      </View>
      <View style={{ paddingRight: 10, gap: 4 }}>
        {items.length ? (
          items.map((t, i) => (
            <T key={i} variant="subhead" color={fg} style={{ fontSize: 14, lineHeight: 20, fontWeight: "400" }}>
              {items.length > 1 ? `• ${t}` : t}
            </T>
          ))
        ) : (
          <T variant="subhead" color={c.muted} style={{ fontSize: 14, lineHeight: 20, fontWeight: "400" }}>
            {emptyText}
          </T>
        )}
      </View>
    </View>
  );
}
