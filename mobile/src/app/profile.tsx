import { useState } from "react";
import { ScrollView } from "react-native";
import { Field, Row, Section } from "@/components/list";
import { Empty, ErrorBanner, PrimaryButton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { notice } from "@/lib/confirm";
import { permissionsFor, roleLabel } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { invalidate } from "@/lib/useData";
import { KeyboardAware } from "@/components/KeyboardAware";

export default function ProfileScreen() {
  const { me, group, reloadGroups } = useSession();
  const mine = group?.members.find((m) => m.userId === me?.id);
  const [nickname, setNickname] = useState(mine?.nickname ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group || !mine) return <Empty title="그룹에 속해 있지 않아요" />;
  const p = permissionsFor(group, me);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/groups/${group!.id}/members/${mine!.id}`, { method: "PATCH", body: { nickname: nickname.trim() } });
      await reloadGroups();
      invalidate();
      notice("저장했어요");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAware style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 24 }}>
        {error ? <ErrorBanner message={error} /> : null}
        <Section title="계정">
          <Row label="이름" value={me?.name ?? "이름 없음"} />
          {me?.email ? <Row label="이메일" value={me.email} /> : null}
          {me?.employeeId ? <Row label="사번" value={me.employeeId} /> : null}
          <Row label={`${group.name}에서 내 역할`} value={[p.isGroupAdmin ? "그룹 관리자" : roleLabel(mine.role), mine.canNotify ? "알림 권한" : null, me?.isOperator ? "운영자" : null].filter(Boolean).join(" · ")} />
        </Section>
        <Field
          label={`${group.name}에서 쓸 닉네임`}
          value={nickname}
          onChangeText={setNickname}
          maxLength={30}
          placeholder={me?.name ?? ""}
          hint="일정의 인원 이름과 인원 현황에 이 닉네임이 쓰여요. 비우면 계정 이름을 써요."
        />
        <PrimaryButton label="저장" busy={busy} onPress={save} />
      </ScrollView>
    </KeyboardAware>
  );
}
