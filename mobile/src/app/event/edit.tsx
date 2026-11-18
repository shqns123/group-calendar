import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
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
type LeaveType = (typeof LEAVE_TYPES)[number];

/** A new event's starting values handed over by the quick-add bar ("수정" on its AI reading). */
export type EventPrefill = {
  category: EventCategory;
  title: string;
  start: DateKey;
  end: DateKey;
  people: string[];
  description: string;
};

function readPrefill(raw: string | undefined): EventPrefill | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<EventPrefill>;
    const key = (k: unknown) => (typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : null);
    const start = key(o.start);
    if (!start) return null;
    const end = key(o.end) ?? start;
    return {
      category: o.category === "ATTENDANCE" ? "ATTENDANCE" : "BUSINESS_TRIP",
      title: typeof o.title === "string" ? o.title : "",
      start,
      end: end < start ? start : end,
      people: Array.isArray(o.people) ? o.people.filter((x): x is string => typeof x === "string") : [],
      description: typeof o.description === "string" ? o.description : "",
    };
  } catch {
    return null;
  }
}

export default function EventEditScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ id?: string; date?: string; draft?: string }>();
  const editingId = params.id ?? null;
  const prefill = editingId ? null : readPrefill(params.draft);
  const baseDate: DateKey = prefill?.start ?? (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey());
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
  return <EventForm key={existing?.id ?? params.draft ?? "new"} existing={existing} baseDate={baseDate} prefill={prefill} />;
}

function EventForm({ existing, baseDate, prefill }: { existing: CalEvent | null; baseDate: DateKey; prefill: EventPrefill | null }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { group, me } = useSession();
  const roster = rosterOf(group);
  const myName = myLabel(group, me);
  const editingId = existing?.id ?? null;
  const alloc = parseAllocation(existing?.equipment);

  // Starting values: the event being edited, else the quick-add bar's reading, else blank.
  const seed = existing
    ? { category: existing.category, title: existing.title, start: toKey(existing.startDate), end: toKey(existing.endDate), people: splitList(existing.personnel), description: existing.description ?? "" }
    : prefill;
  const [category, setCategory] = useState<EventCategory>(seed?.category ?? "BUSINESS_TRIP");
  const [title, setTitle] = useState(seed && seed.category !== "ATTENDANCE" ? seed.title : "");
  const [leaveType, setLeaveType] = useState<LeaveType>(() =>
    seed?.category === "ATTENDANCE"
      ? ((LEAVE_TYPES as readonly string[]).includes(seed.title) ? (seed.title as LeaveType) : "기타")
      : "월휴",
  );
  const [start, setStart] = useState<DateKey>(seed?.start ?? baseDate);
  const [end, setEnd] = useState<DateKey>(seed?.end ?? baseDate);
  const [description, setDescription] = useState(seed?.description ?? "");
  const [people, setPeople] = useState<Set<string>>(() => new Set(seed?.people ?? []));
  const [items, setItems] = useState<Set<string>>(() => new Set([...alloc.items, ...(alloc.targetCount ? [`Target x${alloc.targetCount}`] : [])]));
  const [equipmentOnly, setEquipmentOnly] = useState(Boolean(existing?.equipmentOnly));
  const [color, setColor] = useState(existing?.color ?? EVENT_COLORS[0].hex);
  const [eqTab, setEqTab] = useState("");
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

  // From the latest selection, so quick taps on several rows all count.
  function toggle(update: (fn: (cur: Set<string>) => Set<string>) => void, value: string) {
    update((cur) => {
      const next = new Set(cur);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
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
      equipment: isTrip ? formatAllocation(Array.from(items), 0) || null : null,
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
  // One tab per 장비 분류 from group settings, then 타겟 (a count).
  // Items this event already had that no category lists any more (분류·장비 deleted later): a 기타 tab so they can be unticked.
  const orphans = Array.from(items).filter((i) => !eq.categories.some((cat) => cat.items.includes(i) || (cat.quantity !== undefined && [cat.id === "target" ? "Target" : cat.name, ...(cat.aliases ?? [])].some((name) => i.startsWith(`${name} x`)))));
  const equipTabs = [
    ...eq.categories.map((cat) => ({ id: cat.id, label: cat.name, items: cat.items, quantity: cat.quantity, quantityRemaining: cat.quantityRemaining, aliases: cat.aliases })),
    ...(orphans.length ? [{ id: "orphan", label: "기타", items: orphans, quantity: undefined, quantityRemaining: undefined, aliases: undefined }] : []),
  ];
  const activeTab = equipTabs.find((tab) => tab.id === eqTab) ?? equipTabs[0] ?? { id: "empty", label: "장비", items: [], quantity: undefined, quantityRemaining: undefined, aliases: undefined };
  const equipList = activeTab.items;
  const equipSummary = [...Array.from(items), ...(equipmentOnly ? ["반출만"] : [])].join(", ");
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
                  {/* A checklist: one person per row, tap to pick. */}
                  <CheckList>
                    {roster.map((n, i) => (
                      <CheckRow key={n} label={n} first={i === 0} checked={people.has(n)} onPress={() => toggle(setPeople, n)} />
                    ))}
                  </CheckList>
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
                  {/* Up to four tabs share the row; more scroll sideways. */}
                  <ScrollView
                    horizontal
                    scrollEnabled={equipTabs.length > 4}
                    showsHorizontalScrollIndicator={false}
                    accessibilityRole="tablist"
                    contentContainerStyle={{ flexGrow: 1, gap: 6 }}
                  >
                    {equipTabs.map((tab) => {
                      const prefix = tab.id === "target" ? "Target" : tab.label;
                      const count = tab.quantity !== undefined ? Array.from(items).filter((item) => [prefix, ...(tab.aliases ?? [])].some((name) => item.startsWith(`${name} x`) && /^\d+$/.test(item.slice(name.length + 2)))).reduce((sum, item) => sum + Number(item.slice(item.lastIndexOf(" x") + 2)), 0) : tab.items.filter((i) => items.has(i)).length;
                      return (
                        <View key={tab.id} style={equipTabs.length > 4 ? { minWidth: 80 } : { flex: 1 }}>
                          <Chip size="sm" tone="ink" accessibilityRole="tab" label={count ? `${tab.label} ${count}` : tab.label} selected={activeTab.id === tab.id} onPress={() => setEqTab(tab.id)} />
                        </View>
                      );
                    })}
                  </ScrollView>
                  {activeTab.quantity !== undefined ? (() => {
                    const prefix = activeTab.id === "target" ? "Target" : activeTab.label;
                    const prefixes = [prefix, ...(activeTab.aliases ?? [])];
                    const tokens = Array.from(items).filter((item) => prefixes.some((name) => item.startsWith(`${name} x`) && /^\d+$/.test(item.slice(name.length + 2))));
                    const count = tokens.reduce((sum, item) => sum + Number(item.slice(item.lastIndexOf(" x") + 2)), 0);
                    const limit = activeTab.quantityRemaining ?? 0;
                    const change = (next: number) => setItems((current) => { const copy = new Set(current); tokens.forEach((token) => copy.delete(token)); if (next > 0) copy.add(`${prefix} x${next}`); return copy; });
                    return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: HIT }}>
                      <T variant="body">{`${activeTab.label} ${count}개 (남은 ${limit}개)`}</T>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Stepper label={`${activeTab.label} 하나 빼기`} sign="−" disabled={count <= 0} onPress={() => change(count - 1)} />
                        <Stepper label={`${activeTab.label} 하나 더하기`} sign="+" disabled={count >= limit} onPress={() => change(count + 1)} />
                      </View>
                    </View>;
                  })() : equipList.length === 0 ? (
                    <T variant="subhead" color={c.muted}>
                      {`${activeTab.label}에 등록된 장비가 없어요. 그룹 설정에서 추가할 수 있어요.`}
                    </T>
                  ) : (
                    <CheckList>
                      {equipList.map((code, i) => {
                        const busy = eq.used.has(code) && !items.has(code);
                        return (
                          <CheckRow
                            key={code}
                            label={code}
                            first={i === 0}
                            note={busy ? "다른 일정에서 사용 중" : undefined}
                            disabled={busy}
                            checked={items.has(code)}
                            onPress={() => toggle(setItems, code)}
                          />
                        );
                      })}
                    </CheckList>
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


/** Rows a pick-list shows at once; longer lists scroll inside their own box. */
const LIST_ROWS = 5;

/**
 * Pick-list box: up to five rows visible, the rest scroll inside it (nested in the form's own
 * scroll, so Android needs nestedScrollEnabled). The scrollbar stays visible as the hint.
 */
function CheckList({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      accessibilityRole="list"
      nestedScrollEnabled
      persistentScrollbar
      keyboardShouldPersistTaps="handled"
      style={{ maxHeight: LIST_ROWS * HIT + (LIST_ROWS - 1) }}
    >
      {children}
    </ScrollView>
  );
}

/** One row of a pick-list (인원, 장비): name on the left, a round check on the right. */
function CheckRow({
  label,
  note,
  checked,
  disabled,
  first,
  onPress,
}: {
  label: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  first?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={note ? `${label}, ${note}` : label}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: HIT,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.outline,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="body" numberOfLines={1} color={disabled ? c.muted : c.text} style={{ fontSize: 15, fontWeight: checked ? "600" : "400" }}>
          {label}
        </T>
        {note ? (
          <T variant="caption" color={c.muted} style={{ fontSize: 12 }}>
            {note}
          </T>
        ) : null}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: checked ? c.primary : "transparent",
          borderWidth: checked ? 0 : 1.5,
          borderColor: disabled ? c.outline : c.strong,
        }}
      >
        {checked ? <Icon name="check" size={16} color={c.onPrimary} /> : null}
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
