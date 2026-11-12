import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { DateField } from "@/components/DateField";
import { Field, MiniButton, Row, Section } from "@/components/list";
import { Empty, ErrorBanner, PrimaryButton, Segmented } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { shortLabel, todayKey, type DateKey } from "@/lib/date";
import { useSession } from "@/lib/session";
import type { CustomHoliday } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";

export default function HolidaysScreen() {
  const { me } = useSession();
  const { data, error, refresh } = useData("holidays", () => api<CustomHoliday[]>("/api/admin/holidays"));
  const [date, setDate] = useState<DateKey>(todayKey());
  const [kind, setKind] = useState<"holiday" | "workday">("holiday");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!me?.isOperator) return <Empty title="운영자만 볼 수 있어요" />;

  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      invalidate();
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const upcoming = (data ?? []).filter((h) => h.date >= todayKey().slice(0, 4));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 40 }}>
        {error || actionError ? <ErrorBanner message={(actionError ?? error)!} /> : null}

        <Section title="휴일 추가" footer="모든 그룹 캘린더에 똑같이 적용돼요. 같은 날짜에 다시 저장하면 덮어써요.">
          <View style={{ padding: 14, gap: 14 }}>
            <Segmented label="종류" values={["회사 휴일", "대체 근무일"]} index={kind === "holiday" ? 0 : 1} onChange={(i) => setKind(i === 0 ? "holiday" : "workday")} />
            <View style={{ flexDirection: "row", borderWidth: 0 }}>
              <DateField label="날짜" value={date} onChange={setDate} />
            </View>
            <Field label="이름 (선택)" value={name} onChangeText={setName} maxLength={30} placeholder={kind === "holiday" ? "회사 휴일" : "대체 근무일"} />
            <PrimaryButton
              label="저장"
              busy={busy}
              onPress={() =>
                mutate(async () => {
                  await api("/api/admin/holidays", { method: "POST", body: { date, name, type: kind } });
                  setName("");
                })
              }
            />
          </View>
        </Section>

        <Section title={`등록된 휴일 ${upcoming.length}개`}>
          {upcoming.map((h) => (
            <Row
              key={h.id}
              icon={h.type === "holiday" ? "holiday" : "calendar"}
              label={h.name}
              value={`${shortLabel(h.date)} · ${h.type === "holiday" ? "회사 휴일" : "대체 근무일"}`}
              trailing={
                <MiniButton
                  tone="danger"
                  label="삭제"
                  disabled={busy}
                  onPress={async () => {
                    if (await confirm("휴일 삭제", `${shortLabel(h.date)} ${h.name}을(를) 삭제할까요?`, "삭제", true))
                      void mutate(() => api("/api/admin/holidays", { method: "DELETE", body: { id: h.id } }));
                  }}
                />
              }
            />
          ))}
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
