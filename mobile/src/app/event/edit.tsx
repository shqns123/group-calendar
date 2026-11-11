import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DateField } from "@/components/DateField";
import { Icon } from "@/components/Icon";
import { Card, Chip, ErrorBanner, Loading, Segmented, T, Toggle } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { keyToIso, todayKey, toKey, type DateKey } from "@/lib/date";
import { equipmentFor, formatAllocation, parseAllocation, splitList } from "@/lib/roster";
import { myLabel, rosterOf, useSession } from "@/lib/session";
import type { CalEvent, EventCategory, EventInput } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { EVENT_COLORS, HIT, radius, type } from "@/theme/tokens";

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
  const [saving, setSaving] = useState(false);
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
    setError(null);
    try {
      if (editingId) await api(`/api/events/${editingId}`, { method: "PATCH", body });
      else await api("/api/events", { method: "POST", body });
      invalidate();
      router.back();
    } catch (e) {
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
        router.back();
      } catch (e) {
        setError(errorMessage(e));
        setSaving(false);
      }
    };
    if (Platform.OS === "web") {
      void run();
      return;
    }
    Alert.alert("일정 삭제", "이 일정을 삭제할까요? 되돌릴 수 없어요.", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => void run() },
    ]);
  }

  const heading = editingId ? "일정 수정" : "일정 추가";
  const equipList = eqTab === "tracker" ? eq.trackers : eqTab === "laptop" ? eq.laptops : [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      {Platform.OS === "android" ? (
        <View style={{ paddingTop: insets.top, height: 64 + insets.top, flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 4, paddingRight: 12, backgroundColor: c.surface }}>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={() => router.back()} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 }}>
            <Icon name="close" color={c.text} />
          </Pressable>
          <T variant="title2" accessibilityRole="header" style={{ flex: 1, fontWeight: "400" }}>
            {heading}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="저장"
            onPress={save}
            disabled={saving}
            style={{ minHeight: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: c.primary, justifyContent: "center", opacity: saving ? 0.5 : 1 }}
          >
            <T variant="subhead" style={{ fontWeight: "500" }} color={c.onPrimary}>
              저장
            </T>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingTop: Platform.OS === "ios" ? 8 : insets.top, paddingHorizontal: 8, paddingBottom: 4, flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.outline }}>
          <Pressable accessibilityRole="button" accessibilityLabel="취소" onPress={() => router.back()} style={{ minHeight: 44, minWidth: 80, justifyContent: "center", paddingHorizontal: 8 }}>
            <T variant="body" color={c.primaryText}>
              취소
            </T>
          </Pressable>
          <T variant="headline" accessibilityRole="header" style={{ flex: 1, textAlign: "center" }}>
            {heading}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel="저장" onPress={save} disabled={saving} style={{ minHeight: 44, minWidth: 80, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 8, opacity: saving ? 0.5 : 1 }}>
            <T variant="headline" color={c.primaryText}>
              저장
            </T>
          </Pressable>
        </View>
      )}

      {(
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
          {error ? <ErrorBanner message={error} /> : null}

          <Segmented label="일정 종류" values={["출장", "근태"]} index={isTrip ? 0 : 1} onChange={(i) => setCategory(i === 0 ? "BUSINESS_TRIP" : "ATTENDANCE")} />

          <Card style={{ padding: 0, paddingVertical: 0, paddingHorizontal: 0, overflow: "hidden" }}>
            {isTrip ? (
              <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderBottomColor: c.outline }}>
                <T variant="footnote" color={c.text2} nativeID="title-label">
                  제목 <T variant="footnote" color={c.danger}>*</T>
                </T>
                <TextInput
                  accessibilityLabelledBy="title-label"
                  accessibilityLabel="제목"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={100}
                  placeholder="예: 광주 출장"
                  placeholderTextColor={c.muted}
                  style={[type.headline, { color: c.text, minHeight: 28, padding: 0 }]}
                />
              </View>
            ) : (
              <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: c.outline }}>
                <T variant="footnote" color={c.text2}>
                  근태 종류
                </T>
                <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 6 }}>
                  {LEAVE_TYPES.map((l) => (
                    <View key={l} style={{ flex: 1 }}>
                      <Chip label={l} selected={leaveType === l} onPress={() => setLeaveType(l)} />
                    </View>
                  ))}
                </View>
              </View>
            )}
            <View style={{ flexDirection: "row" }}>
              <DateField label="시작" value={start} onChange={(k) => { setStart(k); if (end < k) setEnd(k); }} />
              <View style={{ width: 1, backgroundColor: c.outline }} />
              <DateField label="종료" value={end} minimum={start} onChange={setEnd} />
            </View>
          </Card>

          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T variant="footnote" color={c.text2}>
                설명 (선택)
              </T>
              <T variant="footnote" color={c.muted} accessibilityElementsHidden importantForAccessibility="no">
                {`${description.length} / 500`}
              </T>
            </View>
            <TextInput
              accessibilityLabel="설명"
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              placeholder="업무 내용이나 준비물을 적어 주세요"
              placeholderTextColor={c.muted}
              style={[type.body, { color: c.text, minHeight: 72, padding: 0, textAlignVertical: "top" }]}
            />
          </Card>

          {!(isTrip && equipmentOnly) ? (
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <T variant="headline" accessibilityRole="header">
                  인원 선택
                </T>
                <T variant="footnote" color={c.primaryText}>{`${people.size}명 선택`}</T>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {roster.map((n) => (
                  <Chip key={n} label={n} selected={people.has(n)} onPress={() => toggle(people, n, setPeople)} />
                ))}
              </View>
              <T variant="footnote" color={c.muted} style={{ fontWeight: "400" }}>
                {`선택하지 않으면 작성자(${myName})가 기본 인원이 돼요.`}
              </T>
            </Card>
          ) : null}

          {isTrip ? (
            <Card style={{ gap: 10 }}>
              <T variant="headline" accessibilityRole="header">
                장비 선택
              </T>
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
                      <View key={code} style={{ width: "23.5%" }}>
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
                <Toggle label="장비 반출만" value={equipmentOnly} onChange={setEquipmentOnly} />
              </View>
            </Card>
          ) : null}

          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T variant="headline" accessibilityRole="header">
                색상
              </T>
              <T variant="footnote" color={c.text2}>
                {EVENT_COLORS.find((x) => x.hex === color)?.name ?? ""}
              </T>
            </View>
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {EVENT_COLORS.map((col) => {
                const on = col.hex === color;
                return (
                  <Pressable
                    key={col.hex}
                    accessibilityRole="radio"
                    accessibilityLabel={col.name}
                    accessibilityState={{ checked: on }}
                    onPress={() => setColor(col.hex)}
                    style={{ width: "20%", height: 48, alignItems: "center", justifyContent: "center" }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col.hex, alignItems: "center", justifyContent: "center", borderWidth: on ? 3 : 0, borderColor: c.card, outlineColor: col.hex, outlineWidth: on ? 2 : 0, outlineStyle: "solid" }}>
                      {on ? <Icon name="check" size={18} color="#FFFFFF" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {editingId ? (
            <Pressable accessibilityRole="button" onPress={confirmDelete} disabled={saving} style={{ minHeight: 52, borderRadius: radius.card, borderWidth: 1, borderColor: c.outline, backgroundColor: c.card, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }}>
              <Icon name="trash" size={20} color={c.danger} />
              <T variant="headline" color={c.danger}>
                일정 삭제
              </T>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
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
      style={{ width: HIT, height: HIT, borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.card, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}
    >
      <T variant="title2">{sign}</T>
    </Pressable>
  );
}
