import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionBar, ACTION_BAR_H } from "@/components/ActionBar";
import { DateRangeField } from "@/components/DateRangeField";
import type { SavePhase } from "@/components/SaveButton";
import { Icon } from "@/components/Icon";
import { Empty, ErrorBanner, Loading, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { longLabel, todayKey, type DateKey } from "@/lib/date";
import { permissionsFor } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import type { DayNoteEntry, PersonalNoteItem } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { HIT, radius, type } from "@/theme/tokens";
import { KeyboardAware } from "@/components/KeyboardAware";
import { closeScreen } from "@/lib/nav";
import { prefersReducedMotion } from "@/lib/motion";

type Kind = "group" | "personal";
type Item = { id: string; text: string; assignee: string; startDate?: string; endDate?: string };

const newId = () => `memo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function MemoEditScreen() {
  const params = useLocalSearchParams<{ date?: string; kind?: string }>();
  const date: DateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey();
  const kind: Kind = params.kind === "personal" ? "personal" : "group";
  const { group, me } = useSession();

  const { data, error } = useData(group || kind === "personal" ? `memo:${kind}:${group?.id ?? ""}:${date}` : null, async () => {
    if (kind === "personal") {
      const res = await api<{ note: { items?: PersonalNoteItem[] } | null }>("/api/personal-notes", { query: { date } });
      return (res.note?.items ?? []).map((i) => ({ id: i.id, text: i.text, assignee: "" }));
    }
    const res = await api<{ note: { items?: DayNoteEntry[] } | null }>("/api/day-notes", { query: { groupId: group!.id, date } });
    return (res.note?.items ?? []).map((i) => ({ id: i.id, text: i.text, assignee: i.assignee ?? "", startDate: i.startDate, endDate: i.endDate }));
  });

  if (kind === "group" && !permissionsFor(group, me).canEditDayNote) return <Empty title="업무 메모 편집 권한이 없어요" body="그룹 관리자, 그룹장, 파트장만 편집할 수 있어요." />;
  if (!data) return error ? <ErrorBanner message={error} /> : <Loading />;
  return <MemoForm key={`${kind}:${date}`} kind={kind} date={date} initial={data} />;
}

function MemoForm({ kind, date, initial }: { kind: Kind; date: DateKey; initial: Item[] }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { group } = useSession();
  const [items, setItems] = useState<Item[]>(initial.length ? initial : [{ id: newId(), text: "", assignee: "" }]);
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const title = kind === "group" ? "업무 메모" : "개인 메모";
  const limit = kind === "group" ? 200 : 1000;

  // Functional update: the date picker can change start and end in the same tap.
  const update = (id: string, patch: Partial<Item>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function save() {
    const clean = items.filter((i) => i.text.trim());
    setPhase("saving");
    setError(null);
    try {
      if (kind === "personal") {
        await api("/api/personal-notes", { method: "PUT", body: { date, items: clean.map((i) => ({ id: i.id, text: i.text.trim() })) } });
      } else {
        await api("/api/day-notes", {
          method: "PUT",
          body: { groupId: group!.id, date, entries: clean.map((i) => ({ id: i.id, text: i.text.trim(), assignee: i.assignee.trim(), startDate: i.startDate ?? date, endDate: i.endDate ?? date })) },
        });
      }
      invalidate();
      // 저장 → spinner → check, then close (same as the event form).
      setPhase("done");
      setTimeout(() => closeScreen(router), prefersReducedMotion() ? 0 : 420);
    } catch (e) {
      setError(errorMessage(e));
      setPhase("idle");
    }
  }

  return (
    <KeyboardAware style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, gap: 10, paddingTop: (Platform.OS === "ios" ? 16 : insets.top) + 28, paddingBottom: insets.bottom + ACTION_BAR_H + 40 }}
      >
        {/* Big left title like the event form; 취소 | 저장 float at the bottom. */}
        <View style={{ marginLeft: 22, marginBottom: 8, gap: 2 }}>
          <T variant="title1" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 34, fontWeight: "700" }}>
            {title}
          </T>
          <T variant="footnote" color={c.text2} style={{ fontWeight: "400" }}>
            {longLabel(date)}
          </T>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
        <T variant="footnote" color={c.muted} style={{ fontWeight: "400", marginHorizontal: 22 }}>
          {kind === "group" ? "그룹 멤버 모두에게 보여요. 항목마다 기간과 담당자를 정할 수 있고, 기간 안의 날짜마다 같은 메모가 보여요." : "나만 볼 수 있는 메모예요."}
        </T>
        {items.map((item, idx) => (
          <View key={item.id} style={{ backgroundColor: c.card, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 20, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T variant="footnote" color={c.text2}>{`메모 ${idx + 1}`}</T>
              <Pressable accessibilityRole="button" accessibilityLabel={`메모 ${idx + 1} 삭제`} onPress={() => setItems(items.filter((i) => i.id !== item.id))} style={{ width: HIT, height: HIT, alignItems: "center", justifyContent: "center", marginVertical: -10, marginRight: -10 }}>
                <Icon name="trash" size={20} color={c.danger} />
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel={`메모 ${idx + 1} 내용`}
              value={item.text}
              onChangeText={(v) => update(item.id, { text: v })}
              maxLength={limit}
              multiline
              placeholder="내용을 입력하세요"
              placeholderTextColor={c.muted}
              style={[type.body, { color: c.text, minHeight: 48, padding: 0, textAlignVertical: "top" }]}
            />
            {kind === "group" ? (
              // 기간: the server copies the memo onto every day in the range (web: lib/dayNotes expandDayNoteDateRange).
              // Same picker as the event form: tap a date and a month calendar unfolds under it.
              <View style={{ borderTopWidth: 1, borderTopColor: c.outline }}>
                <DateRangeField
                  start={item.startDate ?? date}
                  end={item.endDate ?? date}
                  onChangeStart={(k) => update(item.id, { startDate: k })}
                  onChangeEnd={(k) => update(item.id, { endDate: k })}
                />
              </View>
            ) : null}
            {kind === "group" ? (
              <TextInput
                accessibilityLabel={`메모 ${idx + 1} 담당자`}
                value={item.assignee}
                onChangeText={(v) => update(item.id, { assignee: v })}
                maxLength={30}
                placeholder="담당자 (선택)"
                placeholderTextColor={c.muted}
                style={[type.subhead, { color: c.text, minHeight: 36, paddingVertical: 6, paddingHorizontal: 0, borderTopWidth: 1, borderTopColor: c.outline }]}
              />
            ) : null}
          </View>
        ))}
        {items.length < 20 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setItems([...items, { id: newId(), text: "", assignee: "" }])}
            style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.control, backgroundColor: c.subtle, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name="add" size={20} color={c.text2} />
            <T variant="headline" color={c.text2}>
              메모 추가
            </T>
          </Pressable>
        ) : null}
      </ScrollView>
      <ActionBar onCancel={() => closeScreen(router)} onSave={save} phase={phase} />
    </KeyboardAware>
  );
}
