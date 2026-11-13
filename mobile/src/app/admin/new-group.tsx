import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { Field } from "@/components/list";
import { Empty, ErrorBanner, PrimaryButton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Group } from "@/lib/types";
import { KeyboardAware } from "@/components/KeyboardAware";
import { closeScreen } from "@/lib/nav";

export default function NewGroupScreen() {
  const router = useRouter();
  const { me, reloadGroups, selectGroup } = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me?.isOperator) return <Empty title="운영자만 그룹을 만들 수 있어요" />;

  async function create() {
    if (!name.trim()) {
      setError("그룹 이름을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const g = await api<Group>("/api/groups", { method: "POST", body: { name: name.trim(), description: description.trim() } });
      await reloadGroups();
      if (g?.id) selectGroup(g.id);
      closeScreen(router, "/settings");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <KeyboardAware style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 18 }}>
        {error ? <ErrorBanner message={error} /> : null}
        <Field label="그룹 이름" value={name} onChangeText={setName} maxLength={50} autoFocus />
        <Field label="설명 (선택)" value={description} onChangeText={setDescription} maxLength={200} multiline />
        <PrimaryButton label="만들기" busy={busy} onPress={create} />
      </ScrollView>
    </KeyboardAware>
  );
}
