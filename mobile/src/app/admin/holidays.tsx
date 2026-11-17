import { useState } from "react";
import { ScrollView, View } from "react-native";
import { DateField } from "@/components/DateField";
import { Field, MiniButton, Row, Section } from "@/components/list";
import { Chip, Empty, ErrorBanner, PrimaryButton, Segmented } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { parseKey, shortLabel, todayKey, type DateKey } from "@/lib/date";
import { useSession } from "@/lib/session";
import type { CustomHoliday } from "@/lib/types";
import { invalidate, useData } from "@/lib/useData";
import { KeyboardAware } from "@/components/KeyboardAware";

export default function HolidaysScreen() {
  const { me } = useSession();
  const { data, error, refresh } = useData("holidays", () => api<CustomHoliday[]>("/api/admin/holidays"));
  const [date, setDate] = useState<DateKey>(todayKey());
  const [kind, setKind] = useState<"holiday" | "workday">("holiday");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // The year shown in the list (null: this year).
  const [year, setYear] = useState<number | null>(null);

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

  // Every year that has entries (and this year); the chosen one's entries grouped by month.
  const thisYear = parseKey(todayKey()).year;
  const years = [...new Set([thisYear, ...(data ?? []).map((h) => parseKey(h.date).year)])].sort((x, y) => x - y);
  const shownYear = year ?? thisYear;
  const byMonth = new Map<number, CustomHoliday[]>();
  for (const h of [...(data ?? [])].sort((x, y) => x.date.localeCompare(y.date))) {
    const { year: hy, month } = parseKey(h.date);
    if (hy !== shownYear) continue;
    byMonth.set(month, [...(byMonth.get(month) ?? []), h]);
  }
  const months = [...byMonth.entries()];

  return (
    <KeyboardAware style={{ flex: 1 }}>
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

        <View style={{ gap: 12 }}>
          {/* Year, then the year's entries by month. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {years.map((y) => (
              <Chip key={y} label={`${y}년`} selected={y === shownYear} onPress={() => setYear(y)} />
            ))}
          </ScrollView>
          {months.length === 0 ? (
            <Section footer={`${shownYear}년에 등록된 회사 휴일·대체 근무일이 없어요.`}>
              <Row label="등록된 휴일 없음" />
            </Section>
          ) : (
            months.map(([month, list]) => (
              <Section key={month} title={`${month}월 · ${list.length}개`}>
                {list.map((h) => (
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
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAware>
  );
}
