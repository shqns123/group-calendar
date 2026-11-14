import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { confirm } from "@/lib/confirm";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionBar, ACTION_BAR_H } from "@/components/ActionBar";
import { Collapse } from "@/components/Collapse";
import { DateRangeField } from "@/components/DateRangeField";
import { Icon } from "@/components/Icon";
import { Chip, ErrorBanner, Loading, Segmented, T, Toggle } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { keyToIso, todayKey, toKey, type DateKey } from "@/lib/date";
import { equipmentFor, formatAllocation, parseAllocation, splitList } from "@/lib/roster";
import { myLabel, rosterOf, useSession } from "@/lib/session";
import type { CalEvent, EventCategory, EventInput } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { EVENT_COLORS, HIT, radius, type } from "@/theme/tokens";
import { ColorDot } from "@/components/ColorDot";
import type { SavePhase } from "@/components/SaveButton";
import { DUR, prefersReducedMotion } from "@/lib/motion";
import { KeyboardAware } from "@/components/KeyboardAware";
import { closeScreen } from "@/lib/nav";

const LEAVE_TYPES = ["월휴", "무휴", "유휴", "기타"] as const;
const EQUIP_TABS = [
  { id: "tracker", label: "트래커" },
  { id: "laptop", label: "노트북" },
  { id: "target", label: "타겟" },
] as const;

type LeaveType = (typeof LEAVE_TYPES)[number];

export default function EventEditScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const editingId = params.id ?? null;
  const baseDate: DateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey();
  const { group } = useSession();

  // Load the event being edited (the server has no single-event GET; read its day).
  const { data: list, fresh, error } = useData(editingId && group ? `edit:${editingId}:${baseDate}` : null, () =>
    api<CalEvent[]>("/api/events", { query: { groupId: group!.id, start: keyToIso(baseDate), end: keyToIso(baseDate) } }),
  );
  const existing = list?.find((e) => e.id === editingId) ?? null;

  if (editingId && !existing) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center" }}>
        {error ? <ErrorBanner message={error} /> : fresh ? <ErrorBanner message="일정을 찾지 못했어요. 이미 삭제되었을 수 있어요." /> : <Loading />}
      </View>
    );
  }
  return <EventForm key={existing?.id ?? "new"} existing={existing} baseDate={baseDate} />;
}

function EventForm({ existing, baseDate }: { existing: CalEvent | null; baseDate: DateKey }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { group, me } = useSession();
  const roster = rosterOf(group);
  const myName = myLabel(group, me);
  const editingId = existing?.id ?? null;
  const alloc = parseAllocation(existing?.equipment);

  const [category, setCategory] = useState<EventCategory>(existing?.category ?? "BUSINESS_TRIP");
  const [title, setTitle] = useState(existing && existing.category !== "ATTENDANCE" ? existing.title : "");
  const [leaveType, setLeaveType] = useState<LeaveType>(() =>
    existing?.category === "ATTENDANCE"
      ? ((LEAVE_TYPES as readonly string[]).includes(existing.title) ? (existing.title as LeaveType) : "기타")
      : "월휴",
  );
  const [start, setStart] = useState<DateKey>(existing ? toKey(existing.startDate) : baseDate);
  const [end, setEnd] = useState<DateKey>(existing ? toKey(existing.endDate) : baseDate);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [people, setPeople] = useState<Set<string>>(() => new Set(splitList(existing?.personnel)));
  const [items, setItems] = useState<Set<string>>(() => new Set(alloc.items));
  const [targets, setTargets] = useState(alloc.targetCount);
  const [equipmentOnly, setEquipmentOnly] = useState(Boolean(existing?.equipmentOnly));
  const [color, setColor] = useState(existing?.color ?? EVENT_COLORS[0].hex);
  const [eqTab, setEqTab] = useState<(typeof EQUIP_TABS)[number]["id"]>("tracker");
  const [equipOpen, setEquipOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<SavePhase>("idle");
  const [error, setError] = useState<string | null>(null);

  // Equipment already booked by other events in the chosen range.
  const { data: rangeEvents } = useData(group ? `range:${group.id}:${start}:${end}` : null, () =>
    api<CalEvent[]>("/api/events", { query: { groupId: group!.id, start: keyToIso(start), end: keyToIso(end) } }),
  );
  const eq = useMemo(() => equipmentFor(group, rangeEvents ?? [], editingId ?? undefined), [group, rangeEvents, editingId]);

  const isTrip = category === "BUSINESS_TRIP";

  function toggle(set: Set<string>, value: string, update: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  }

  async function save() {
    if (!group) return;
    const finalTitle = isTrip ? title.trim() : leaveType;
    if (!finalTitle) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (end < start) {
      setError("종료 날짜는 시작 날짜보다 빠를 수 없어요.");
      return;
    }
    const personnel = isTrip && equipmentOnly ? null : people.size ? Array.from(people).join(", ") : isTrip ? null : myName;
    const body: EventInput = {
      category,
      title: finalTitle,
      description: description.trim(),
      startDate: keyToIso(start),
      endDate: keyToIso(end),
      allDay: true,
      color,
      groupId: group.id,
      personnel,
      equipment: isTrip ? formatAllocation(Array.from(items), targets) || null : null,
      equipmentOnly: isTrip ? equipmentOnly : false,
    };
    setSaving(true);
    setSavePhase("saving");
    setError(null);
    try {
      if (editingId) await api(`/api/events/${editingId}`, { method: "PATCH", body });
      else await api("/api/events", { method: "POST", body });
      invalidate();
      // Button → spinner → check, then close.
      setSavePhase("done");
      setTimeout(() => closeScreen(router), prefersReducedMotion() ? 0 : 420);
    } catch (e) {
      setSavePhase("idle");
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!editingId) return;
    const run = async () => {
      setSaving(true);
      try {
        await api(`/api/events/${editingId}`, { method: "DELETE" });
        invalidate();
        closeScreen(router);
      } catch (e) {
        setError(errorMessage(e));
        setSaving(false);
      }
    };
    // App's own popup (fades + scales in, closes faster) instead of the OS alert.
    void confirm("일정 삭제", "이 일정을 삭제할까요? 되돌릴 수 없어요.", "삭제", true).then((ok) => {
      if (ok) void run();
    });
  }

  const heading = editingId ? "일정 수정" : "일정 추가";
  const equipList = eqTab === "tracker" ? eq.trackers : eqTab === "laptop" ? eq.laptops : [];
  // Shown on the collapsed equipment row: "T-03, N-01, 타겟 1, 반출만".
  const equipSummary = [
    ...Array.from(items),
    ...(targets ? [`타겟 ${targets}`] : []),
    ...(equipmentOnly ? ["반출만"] : []),
  ].join(", ");
  const peopleSummary = people.size ? Array.from(people).join(", ") : `${myName} (기본)`;
  const showPeople = !(isTrip && equipmentOnly);

  // Rows open/close with the same short ease as the summary tab (open 220ms, close 180ms).
  function animateNext(opening: boolean) {
    if (prefersReducedMotion()) return;
    const ms = opening ? DUR.open : DUR.close;
    LayoutAnimation.configureNext({
      duration: ms,
      create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity, duration: ms },
      update: { type: LayoutAnimation.Types.easeOut, duration: ms },
      delete: { type: LayoutAnimation.Types.easeIn, property: LayoutAnimation.Properties.opacity, duration: Math.round(ms * 0.6) },
    });
  }

  const divider = <View style={{ height: 1, backgroundColor: c.outline }} />;

  return (
    <KeyboardAware style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: (Platform.OS === "ios" ? 16 : insets.top) + 28, paddingBottom: insets.bottom + ACTION_BAR_H + 40, gap: 16 }}
      >
        <T variant="title1" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 34, fontWeight: "700", marginLeft: 22, marginBottom: 8 }}>
          {heading}
        </T>

        {error ? <ErrorBanner message={error} /> : null}

        <Segmented label="일정 종류" values={["출장", "근태"]} index={isTrip ? 0 : 1} onChange={(i) => setCategory(i === 0 ? "BUSINESS_TRIP" : "ATTENDANCE")} />

        {/* One card; rows split by thin dividers instead of separate section boxes. */}
        <View style={{ backgroundColor: c.card, borderRadius: radius.sheet, paddingHorizontal: 22, paddingVertical: 4 }}>
          {/* Title (or leave type) + colour */}
          {isTrip ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 72, marginRight: -10 }}>
              <TextInput
                accessibilityLabel="제목 (필수)"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                placeholder="제목"
                placeholderTextColor={c.muted}
                style={[type.title2, { flex: 1, color: c.text, fontSize: 17, minHeight: 40, padding: 0 }]}
              />
              <ColorDot value={color} onChange={setColor} />
            </View>
          ) : (
            <View style={{ paddingVertical: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: -10, marginRight: -10 }}>
                <T variant="title2" style={{ fontSize: 17 }}>
                  {leaveType}
                </T>
                <ColorDot value={color} onChange={setColor} />
              </View>
              <View accessibilityRole="radiogroup" accessibilityLabel="근태 종류" style={{ flexDirection: "row", gap: 6 }}>
                {LEAVE_TYPES.map((l) => (
                  <View key={l} style={{ flex: 1 }}>
                    <Chip label={l} selected={leaveType === l} onPress={() => setLeaveType(l)} />
                  </View>
                ))}
              </View>
            </View>
          )}
          {divider}

          {/* Dates: start → end */}
          <DateRangeField start={start} end={end} onChangeStart={setStart} onChangeEnd={setEnd} />
          {divider}

          {/* Description (설명), same field for 출장 and 근태 */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 20 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <TextInput
                accessibilityLabel="설명 (선택)"
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
                placeholder="설명 (선택)"
                placeholderTextColor={c.muted}
                style={[type.body, { color: c.text, fontSize: 15, lineHeight: 24, minHeight: 24, padding: 0, textAlignVertical: "top" }]}
              />
              {description.length ? (
                <T variant="caption" color={c.muted} accessibilityElementsHidden importantForAccessibility="no" style={{ alignSelf: "flex-end" }}>
                  {`${description.length} / 500`}
                </T>
              ) : null}
            </View>
          </View>

          {/* People: closed by default; the row shows who's picked. */}
          {showPeople ? (
            <>
              {divider}
              <ExpandRow
                label="인원"
                value={peopleSummary}
                active={people.size > 0}
                open={peopleOpen}
                onToggle={() => setPeopleOpen(!peopleOpen)}
              />
              <Collapse open={peopleOpen}>
                <View style={{ paddingBottom: 16, gap: 10 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {roster.map((n) => (
                      <Chip key={n} label={n} selected={people.has(n)} onPress={() => toggle(people, n, setPeople)} />
                    ))}
                  </View>
                  <T variant="footnote" color={c.muted} style={{ fontWeight: "400" }}>
                    {`선택하지 않으면 작성자(${myName})가 기본 인원이 돼요.`}
                  </T>
                </View>
              </Collapse>
            </>
          ) : null}

          {/* Equipment (trips only) */}
          {isTrip ? (
            <>
              {divider}
              <ExpandRow
                label="장비"
                value={equipSummary || "선택 없음"}
                active={!!equipSummary}
                open={equipOpen}
                onToggle={() => setEquipOpen(!equipOpen)}
              />
              <Collapse open={equipOpen}>
                <View style={{ paddingBottom: 12, gap: 10 }}>
                  <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 6 }}>
                    {EQUIP_TABS.map((tab) => {
                      const count =
                        tab.id === "target" ? targets : (tab.id === "tracker" ? eq.trackers : eq.laptops).filter((i) => items.has(i)).length;
                      return (
                        <View key={tab.id} style={{ flex: 1 }}>
                          <Chip tone="ink" accessibilityRole="tab" label={count ? `${tab.label} ${count}` : tab.label} selected={eqTab === tab.id} onPress={() => setEqTab(tab.id)} />
                        </View>
                      );
                    })}
                  </View>
                  {eqTab === "target" ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: HIT }}>
                      <T variant="body">{`타겟 ${targets}개 (남은 ${eq.targetRemaining}개)`}</T>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Stepper label="타겟 하나 빼기" sign="−" disabled={targets <= 0} onPress={() => setTargets(targets - 1)} />
                        <Stepper label="타겟 하나 더하기" sign="+" disabled={targets >= eq.targetRemaining} onPress={() => setTargets(targets + 1)} />
                      </View>
                    </View>
                  ) : equipList.length === 0 ? (
                    <T variant="subhead" color={c.muted}>
                      그룹에 등록된 장비가 없어요. 웹 그룹 설정에서 추가할 수 있어요.
                    </T>
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {equipList.map((code) => {
                        const busy = eq.used.has(code) && !items.has(code);
                        return (
                          <View key={code} style={{ width: "31.5%" }}>
                            <Chip tone="info" label={code} note={busy ? "사용 중" : undefined} disabled={busy} selected={items.has(code)} onPress={() => toggle(items, code, setItems)} />
                          </View>
                        );
                      })}
                    </View>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingTop: 4 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T variant="body">장비 반출만</T>
                      <T variant="footnote" color={c.text2} style={{ fontWeight: "400" }}>
                        검교정·대여처럼 인원 없이 장비만 나갈 때
                      </T>
                    </View>
                    <Toggle
                      label="장비 반출만"
                      value={equipmentOnly}
                      onChange={(v) => {
                        animateNext(!v);
                        setEquipmentOnly(v);
                      }}
                    />
                  </View>
                </View>
              </Collapse>
            </>
          ) : null}

          {/* Delete (editing only): last row of the same card */}
          {editingId ? (
            <>
              {divider}
              <Pressable
                accessibilityRole="button"
                onPress={confirmDelete}
                disabled={saving}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 64, opacity: pressed ? 0.6 : 1 })}
              >
                <Icon name="trash" size={24} color={c.danger} />
                <T variant="body" color={c.danger} style={{ fontSize: 17 }}>
                  일정 삭제
                </T>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>

      <ActionBar onCancel={() => closeScreen(router)} onSave={save} phase={savePhase} />
    </KeyboardAware>
  );
}


/** A form row that opens a panel under it: icon, label, current value, chevron. */
function ExpandRow({ label, value, active, open, onToggle }: { label: string; value: string; active: boolean; open: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      accessibilityState={{ expanded: open }}
      onPress={onToggle}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 64, opacity: pressed ? 0.6 : 1 })}
    >
      <T variant="body" style={{ fontSize: 15 }}>
        {label}
      </T>
      <T variant="body" color={active ? c.primaryText : c.muted} numberOfLines={1} style={{ flex: 1, textAlign: "right", fontSize: 13 }}>
        {value}
      </T>
      <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
        <Icon name="down" size={22} color={c.text2} />
      </View>
    </Pressable>
  );
}


function Stepper({ label, sign, onPress, disabled }: { label: string; sign: string; onPress: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{ width: HIT, height: HIT, borderRadius: radius.control, backgroundColor: c.subtle, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}
    >
      <T variant="title2">{sign}</T>
    </Pressable>
  );
}
