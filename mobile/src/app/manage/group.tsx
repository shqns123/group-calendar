import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Field, Section } from "@/components/list";
import { Empty, ErrorBanner, PrimaryButton, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { confirm, notice } from "@/lib/confirm";
import { permissionsFor } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { invalidate } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { HIT, radius } from "@/theme/tokens";
import { KeyboardAware } from "@/components/KeyboardAware";
import { closeScreen } from "@/lib/nav";

export default function GroupSettingsScreen() {
  const { group, me } = useSession();
  if (!group) return <Empty title="선택된 그룹이 없어요" />;
  if (!permissionsFor(group, me).canEditGroup) return <Empty title="그룹 설정 권한이 없어요" body="그룹 관리자와 운영자만 바꿀 수 있어요." />;
  return <GroupForm key={group.id} />;
}

function GroupForm() {
  const { c } = useTheme();
  const router = useRouter();
  const { group, reloadGroups } = useSession();
  const g = group!;
  const [name, setName] = useState(g.name);
  const [description, setDescription] = useState(g.description ?? "");
  const [trackers, setTrackers] = useState(g.trackerOptions ?? "");
  const [laptops, setLaptops] = useState(g.laptopOptions ?? "");
  const [targetCount, setTargetCount] = useState(String(g.targetCount ?? 2));
  const [limit, setLimit] = useState(g.eventDisplayLimit ?? 3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("그룹 이름을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/groups/${g.id}`, {
        method: "PATCH",
        body: { name, description, trackerOptions: trackers, laptopOptions: laptops, targetCount: Number(targetCount) || 0, eventDisplayLimit: limit },
      });
      await reloadGroups();
      invalidate();
      notice("저장했어요");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!(await confirm("그룹 삭제", `${g.name} 그룹과 모든 일정이 삭제돼요. 되돌릴 수 없어요.`, "삭제", true))) return;
    setBusy(true);
    try {
      await api(`/api/groups/${g.id}`, { method: "DELETE" });
      await reloadGroups();
      closeScreen(router, "/settings");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <KeyboardAware style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
        {error ? <ErrorBanner message={error} /> : null}
        <Field label="그룹 이름" value={name} onChangeText={setName} maxLength={50} />
        <Field label="설명" value={description} onChangeText={setDescription} maxLength={200} multiline />
        <Field label="트래커 목록" value={trackers} onChangeText={setTrackers} placeholder="T-01, T-02, T-03" hint="쉼표나 줄바꿈으로 구분해요." multiline />
        <Field label="노트북 목록" value={laptops} onChangeText={setLaptops} placeholder="N-01, N-02" multiline />
        <Field label="타겟 수량" value={targetCount} onChangeText={(v) => setTargetCount(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={3} />

        <View style={{ gap: 6 }}>
          <T variant="footnote" color={c.text2}>
            캘린더 한 칸에 보일 일정 수
          </T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Step label="하나 줄이기" sign="−" disabled={limit <= 1} onPress={() => setLimit(limit - 1)} />
            <T variant="title2" style={{ minWidth: 32, textAlign: "center" }}>
              {limit}
            </T>
            <Step label="하나 늘리기" sign="+" disabled={limit >= 10} onPress={() => setLimit(limit + 1)} />
          </View>
        </View>

        <PrimaryButton label="저장" busy={busy} onPress={save} />

        <Section title="위험 구역">
          <Pressable accessibilityRole="button" onPress={remove} disabled={busy} style={{ minHeight: 52, alignItems: "center", justifyContent: "center" }}>
            <T variant="headline" color={c.danger}>
              그룹 삭제
            </T>
          </Pressable>
        </Section>
      </ScrollView>
    </KeyboardAware>
  );
}

function Step({ label, sign, onPress, disabled }: { label: string; sign: string; onPress: () => void; disabled?: boolean }) {
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
