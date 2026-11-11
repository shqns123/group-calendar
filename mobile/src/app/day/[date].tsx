import type { ReactNode } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { Card, ErrorBanner, IconButton, Loading, PrimaryButton, T, Tag, Toggle } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { eventsOn } from "@/lib/calendar";
import { addDays, dotted, keyToIso, longLabel, parseKey, todayKey, toKey, WEEKDAYS_LONG, weekday, type DateKey } from "@/lib/date";
import { equipmentFor, parseAllocation, personnelFor, splitList } from "@/lib/roster";
import { useSession } from "@/lib/session";
import type { CalEvent, DayNote } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { HIT, radius } from "@/theme/tokens";

export default function DaySheet() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const date: DateKey = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey();
  const { group, me } = useSession();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: events, error, refresh } = useData(group ? `day:${group.id}:${date}` : null, () =>
    api<CalEvent[]>("/api/events", { query: { groupId: group!.id, start: keyToIso(date), end: keyToIso(date) } }),
  );
  const { data: note } = useData(group ? `note:${group.id}:${date}` : null, () =>
    api<{ note: DayNote }>("/api/day-notes", { query: { groupId: group!.id, date } }),
  );

  const day = events ? eventsOn(events, date) : [];
  const work = day.filter((e) => !e.isOvertimeOnly);
  const mine = day.find((e) => e.isOvertimeOnly && e.creatorId === me?.id);
  const otState: "yes" | "no" | "none" = mine ? (mine.overtimeAvailable ? "yes" : "no") : "none";
  const people = personnelFor(group, day);
  const eq = equipmentFor(group, day);

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

  async function clearOvertime() {
    if (!group) return;
    setSaving(true);
    try {
      await api("/api/overtime-status", { method: "DELETE", query: { groupId: group.id, date } });
      invalidate();
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const otRowBg = otState === "yes" ? c.warnContainer : c.card;
  const otRowBorder = otState === "yes" ? c.warnBorder : c.outline;
  const otText = otState === "yes" ? "특근 가능으로 표시됨" : otState === "no" ? "특근 불가능으로 표시됨" : "아직 표시하지 않았어요";
  const otColor = otState === "yes" ? c.onWarn : otState === "no" ? c.offText : c.muted;
  const noteText = note?.note?.items?.map((i) => i.text).join("\n") || note?.note?.content;

  return (
    <View style={{ flex: 1, backgroundColor: c.sheet }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 20, paddingBottom: 8, paddingLeft: 20, paddingRight: 12 }}>
        <View style={{ gap: 2 }}>
          <T variant="footnote" color={c.primaryText}>
            {WEEKDAYS_LONG[weekday(date)]}
          </T>
          <T variant="title2" accessibilityRole="header">
            {`${parseKey(date).month}월 ${parseKey(date).day}일`}
          </T>
        </View>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <IconButton icon="back" tone="card" label={`이전 날, ${longLabel(addDays(date, -1))}`} onPress={() => router.setParams({ date: addDays(date, -1) })} />
          <IconButton icon="forward" tone="card" label={`다음 날, ${longLabel(addDays(date, 1))}`} onPress={() => router.setParams({ date: addDays(date, 1) })} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
        {saveError ? <ErrorBanner message={saveError} /> : null}

        <View style={{ borderWidth: 1, borderColor: otRowBorder, backgroundColor: otRowBg, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10, minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="headline">내 특근</T>
            <T variant="footnote" color={otColor}>
              {otText}
            </T>
          </View>
          {otState !== "none" ? (
            <Pressable accessibilityRole="button" onPress={clearOvertime} disabled={saving} style={{ minHeight: HIT, justifyContent: "center", paddingHorizontal: 8 }}>
              <T variant="footnote" color={c.text2}>
                지우기
              </T>
            </Pressable>
          ) : null}
          <Toggle tone="overtime" label="내 특근 가능" value={otState === "yes"} onChange={(v) => void setOvertime(v)} />
        </View>

        {noteText ? (
          <View style={{ backgroundColor: c.warnContainer, borderColor: c.warnBorder, borderWidth: 1, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="note" size={16} color={c.onWarn} />
              <T variant="footnote" color={c.onWarn}>
                그룹 메모
              </T>
            </View>
            <T variant="subhead" color={c.onWarn}>
              {noteText}
            </T>
          </View>
        ) : null}

        {!events ? <Loading /> : null}
        {events ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <T variant="headline" accessibilityRole="header">
              인원 현황
            </T>
            <T variant="footnote" color={c.text2}>
              {`전체 ${people.total} · 남음 ${people.remaining.length}`}
            </T>
          </View>
          <Row label="특근 가능" color={c.onWarn}>
            {people.overtime.length ? people.overtime.map((n) => <Tag key={n} label={n} bg={c.warnContainer} fg={c.onWarn} />) : <T variant="footnote" color={c.muted}>없음</T>}
          </Row>
          <Row label="남은 인원" color={c.onOk}>
            {people.remaining.length ? people.remaining.map((n) => <Tag key={n} label={n} bg={c.okContainer} fg={c.onOk} />) : <T variant="footnote" color={c.muted}>없음</T>}
          </Row>
          {eq.trackers.length + eq.laptops.length + eq.targetTotal > 0 ? (
            <View style={{ borderTopWidth: 1, borderTopColor: c.outline, paddingTop: 10 }}>
              <Row label="장비 잔여" color={c.onInfo}>
                {eq.trackers.length ? <Tag label={`트래커 ${eq.trackerRemaining}/${eq.trackers.length}`} bg={c.infoContainer} fg={c.onInfo} /> : null}
                {eq.laptops.length ? <Tag label={`노트북 ${eq.laptopRemaining}/${eq.laptops.length}`} bg={c.infoContainer} fg={c.onInfo} /> : null}
                {eq.targetTotal ? <Tag label={`타겟 ${eq.targetRemaining}/${eq.targetTotal}`} bg={c.infoContainer} fg={c.onInfo} /> : null}
              </Row>
            </View>
          ) : null}
        </Card>
        ) : null}

        {events ? (
          <T variant="footnote" color={c.text2} accessibilityRole="header" style={{ marginTop: 6, marginLeft: 2 }}>
            {`일정 ${work.length}개`}
          </T>
        ) : null}
        {events && work.length === 0 ? (
          <T variant="subhead" color={c.muted} style={{ marginLeft: 2 }}>
            이 날은 일정이 없어요.
          </T>
        ) : null}
        {work.map((e) => {
          const range = toKey(e.startDate) === toKey(e.endDate) ? null : `${dotted(toKey(e.startDate))} – ${dotted(toKey(e.endDate))}`;
          const persons = e.equipmentOnly ? [] : splitList(e.personnel);
          const alloc = parseAllocation(e.equipment);
          const items = [...alloc.items, ...(alloc.targetCount ? [`타겟 ${alloc.targetCount}`] : [])];
          return (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${e.title}${range ? `, ${range}` : ""}${persons.length ? `, ${persons.join(" ")}` : ""}, 수정하기`}
              onPress={() => router.push({ pathname: "/event/edit", params: { id: e.id, date } })}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Card style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: e.color }} />
                  <T variant="headline" numberOfLines={1} style={{ flex: 1 }}>
                    {e.category === "ATTENDANCE" && persons[0] ? `${e.title} · ${persons[0]}` : e.title}
                  </T>
                  {e.category === "ATTENDANCE" ? <Tag label="근태" bg={c.primaryContainer} fg={c.onPrimaryContainer} /> : null}
                  {e.equipmentOnly ? <Tag label="장비 반출" bg={c.infoContainer} fg={c.onInfo} /> : null}
                  {range ? (
                    <T variant="footnote" color={c.text2}>
                      {range}
                    </T>
                  ) : null}
                </View>
                {e.description ? (
                  <T variant="subhead" color={c.text2} numberOfLines={2}>
                    {e.description}
                  </T>
                ) : null}
                {e.category !== "ATTENDANCE" && persons.length + items.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {persons.map((p) => (
                      <Tag key={p} label={p} bg={c.subtle} fg={c.text2} />
                    ))}
                    {items.map((p) => (
                      <Tag key={p} label={p} bg={c.infoContainer} fg={c.onInfo} />
                    ))}
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) + 8, borderTopWidth: 1, borderTopColor: c.outline, backgroundColor: c.sheet }}>
        <PrimaryButton label="일정 추가" icon="add" onPress={() => router.push({ pathname: "/event/edit", params: { date } })} />
      </View>
    </View>
  );
}

function Row({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <T variant="footnote" color={color} style={{ width: 68, paddingTop: 5, fontWeight: "700" }}>
        {label}
      </T>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>{children}</View>
    </View>
  );
}
