import { useState } from "react";
import { ScrollView } from "react-native";
import { Field } from "@/components/list";
import { ErrorBanner, PrimaryButton, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { notice } from "@/lib/confirm";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { KeyboardAware } from "@/components/KeyboardAware";

export default function JoinScreen() {
  const { c } = useTheme();
  const { reloadGroups } = useSession();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    if (!code.trim()) {
      setError("초대 코드를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ groupName: string; pending?: boolean }>("/api/groups/join", { method: "POST", body: { inviteCode: code.trim(), nickname: nickname.trim() } });
      await reloadGroups();
      notice("가입 요청을 보냈어요", `${res.groupName} 그룹장·파트장이 승인하면 그룹 일정을 볼 수 있어요.`);
      setCode("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAware style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 18 }}>
        <T variant="subhead" color={c.text2}>
          그룹장·파트장에게 받은 초대 코드를 입력하세요. 승인되면 그룹 전환 목록에 나타나요.
        </T>
        {error ? <ErrorBanner message={error} /> : null}
        <Field label="초대 코드" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="예: AB12CD" />
        <Field label="닉네임 (선택)" value={nickname} onChangeText={setNickname} maxLength={30} hint="그룹 안에서 표시될 이름이에요. 비우면 계정 이름을 써요." />
        <PrimaryButton label="가입 요청" busy={busy} onPress={join} />
      </ScrollView>
    </KeyboardAware>
  );
}
