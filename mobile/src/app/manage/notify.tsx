import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Field, MiniButton, Section } from "@/components/list";
import { Chip, Empty, ErrorBanner, Loading, PrimaryButton, T, Toggle } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { confirm, notice } from "@/lib/confirm";
import { permissionsFor } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import type { NotificationSchedule } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { KeyboardAware } from "@/components/KeyboardAware";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

export default function NotifyScreen() {
  const { group, me } = useSession();
  if (!group) return <Empty title="선택된 그룹이 없어요" />;
  if (!permissionsFor(group, me).canNotify) return <Empty title="알림 권한이 없어요" body="그룹 관리자에게 알림 보내기 권한을 요청해 주세요." />;
  return <NotifyForm groupId={group.id} groupName={group.name} />;
}

function NotifyForm({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { c } = useTheme();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<NotificationSchedule> | null>(null);

  const { data: schedules, refresh } = useData(`schedules:${groupId}`, () => api<NotificationSchedule[]>("/api/admin/schedules", { query: { groupId } }));

  async function send() {
    if (!message.trim()) return;
    if (!(await confirm("알림 보내기", `${groupName} 멤버 전원에게 보낼까요?\n\n${message.trim()}`, "보내기"))) return;
    setSending(true);
    setError(null);
    try {
      const res = await api<{ sent: number }>("/api/admin/notify", { method: "POST", body: { groupId, message: message.trim() } });
      setMessage("");
      notice("보냈어요", `${res.sent}개 기기로 보냈어요.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function mutate(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      invalidate();
      void refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <KeyboardAware style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 40 }}>
        {error ? <ErrorBanner message={error} /> : null}

        <View style={{ gap: 10 }}>
          <Field label="지금 보내기" value={message} onChangeText={setMessage} maxLength={200} multiline placeholder="예: 내일 오전 9시 현장 집결입니다." hint={`${message.length} / 200 · 푸시 알림으로 바로 전달돼요.`} />
          <PrimaryButton label="보내기" icon="send" busy={sending} disabled={!message.trim()} onPress={send} />
        </View>

        <Section title="정기 알림" footer="정해진 요일·시간마다 자동으로 보내요.">
          {!schedules ? <Loading /> : null}
          {schedules?.length === 0 ? (
            <View style={{ padding: 14 }}>
              <T variant="subhead" color={c.muted}>
                등록된 정기 알림이 없어요.
              </T>
            </View>
          ) : null}
          {schedules?.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${s.message}, ${daysText(s.dayOfWeek)} ${pad(s.timeHour)}:${pad(s.timeMin)}, ${s.active ? "켜짐" : "꺼짐"}, 수정하기`}
              onPress={() => setEditing(s)}
              style={({ pressed }) => ({ minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: c.outline, backgroundColor: pressed ? c.subtle : "transparent" })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="body" numberOfLines={2} color={s.active ? c.text : c.muted}>
                  {s.message}
                </T>
                <T variant="footnote" color={c.text2} style={{ fontWeight: "400" }}>
                  {`${daysText(s.dayOfWeek)} · ${pad(s.timeHour)}:${pad(s.timeMin)}`}
                </T>
              </View>
              <Toggle label="정기 알림 켜기" value={s.active} onChange={(v) => mutate(() => api("/api/admin/schedules", { method: "PATCH", body: { id: s.id, active: v } }))} />
            </Pressable>
          ))}
          <View style={{ padding: 12 }}>
            <MiniButton tone="neutral" label="정기 알림 추가" onPress={() => setEditing({ message: "", dayOfWeek: "1,2,3,4,5", timeHour: 8, timeMin: 30, active: true })} />
          </View>
        </Section>

        {editing ? (
          <ScheduleEditor
            value={editing}
            onCancel={() => setEditing(null)}
            onDelete={
              editing.id
                ? async () => {
                    if (!(await confirm("정기 알림 삭제", "이 정기 알림을 삭제할까요?", "삭제", true))) return;
                    await mutate(() => api("/api/admin/schedules", { method: "DELETE", body: { id: editing.id } }));
                    setEditing(null);
                  }
                : undefined
            }
            onSave={async (v) => {
              await mutate(() =>
                v.id
                  ? api("/api/admin/schedules", { method: "PATCH", body: { id: v.id, message: v.message, dayOfWeek: v.dayOfWeek, timeHour: v.timeHour, timeMin: v.timeMin } })
                  : api("/api/admin/schedules", { method: "POST", body: { groupId, message: v.message, dayOfWeek: v.dayOfWeek, timeHour: v.timeHour, timeMin: v.timeMin } }),
              );
              setEditing(null);
            }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAware>
  );
}

function daysText(dayOfWeek: string) {
  const d = dayOfWeek.split(",").map(Number);
  if (d.join(",") === "1,2,3,4,5") return "평일";
  if (d.length === 7) return "매일";
  return d.map((i) => DAYS[i]).join("·");
}

function ScheduleEditor({
  value,
  onSave,
  onCancel,
  onDelete,
}: {
  value: Partial<NotificationSchedule>;
  onSave: (v: Partial<NotificationSchedule>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { c } = useTheme();
  const [message, setMessage] = useState(value.message ?? "");
  const [days, setDays] = useState<Set<number>>(() => new Set((value.dayOfWeek ?? "").split(",").filter(Boolean).map(Number)));
  const [hour, setHour] = useState(value.timeHour ?? 8);
  const [min, setMin] = useState(value.timeMin ?? 30);

  const toggleDay = (i: number) => {
    const next = new Set(days);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setDays(next);
  };

  return (
    <Section title={value.id ? "정기 알림 수정" : "정기 알림 추가"}>
      <View style={{ padding: 14, gap: 14 }}>
        <Field label="메시지" value={message} onChangeText={setMessage} maxLength={100} hint={`${message.length} / 100`} />
        <View style={{ gap: 6 }}>
          <T variant="footnote" color={c.text2}>
            요일
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {DAYS.map((d, i) => (
              <Chip key={d} label={d} selected={days.has(i)} onPress={() => toggleDay(i)} />
            ))}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <T variant="footnote" color={c.text2}>
            시간
          </T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MiniButton tone="neutral" label="−1시간" onPress={() => setHour((hour + 23) % 24)} />
            <T variant="title2" accessibilityLiveRegion="polite" style={{ minWidth: 72, textAlign: "center" }}>{`${pad(hour)}:${pad(min)}`}</T>
            <MiniButton tone="neutral" label="+1시간" onPress={() => setHour((hour + 1) % 24)} />
            <MiniButton tone="neutral" label="+10분" onPress={() => setMin((min + 10) % 60)} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
          {onDelete ? <MiniButton tone="danger" label="삭제" onPress={onDelete} /> : null}
          <MiniButton tone="neutral" label="취소" onPress={onCancel} />
          <MiniButton
            label="저장"
            disabled={!message.trim() || days.size === 0}
            onPress={() => onSave({ id: value.id, message: message.trim(), dayOfWeek: Array.from(days).sort().join(","), timeHour: hour, timeMin: min })}
          />
        </View>
      </View>
    </Section>
  );
}
