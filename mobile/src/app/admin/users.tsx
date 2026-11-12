import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useActionSheet, type SheetOption } from "@/components/ActionSheet";
import { Row, Section } from "@/components/list";
import { Empty, ErrorBanner, Loading, Tag } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { confirm, notice } from "@/lib/confirm";
import { roleLabel } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import type { AdminUser } from "@/lib/types";
import { useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/tokens";

export default function UsersScreen() {
  const { c } = useTheme();
  const showSheet = useActionSheet();
  const { me, allGroups: groups, reloadGroups } = useSession();
  const { data, error, refreshing, refresh } = useData(me?.isOperator ? "admin:users" : null, () => api<AdminUser[]>("/api/admin/users"));
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((u) => !q || [u.name, u.email, u.employeeId].some((v) => v?.toLowerCase().includes(q)));
  }, [data, query]);

  if (!me?.isOperator) return <Empty title="운영자만 볼 수 있어요" />;

  async function run(fn: () => Promise<unknown>, done?: string) {
    setActionError(null);
    try {
      await fn();
      await refresh();
      await reloadGroups();
      if (done) notice(done);
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  function actions(u: AdminUser) {
    const name = u.name ?? u.email ?? "사용자";
    const isMe = u.id === me?.id;
    const memberOf = new Set(u.groupMembers.map((m) => m.group.id));
    const options: SheetOption[] = [];
    const joinable = groups.filter((g) => !memberOf.has(g.id));
    if (joinable.length) {
      options.push({
        label: "그룹에 추가",
        onPress: () =>
          showSheet({
            title: `${name} 님을 추가할 그룹`,
            options: joinable.map((g) => ({ label: g.name, onPress: () => run(() => api(`/api/admin/users/${u.id}/groups`, { method: "POST", body: { groupId: g.id } }), `${g.name}에 추가했어요`) })),
          }),
      });
    }
    if (!isMe) {
      options.push({
        label: u.isOperator ? "운영자 권한 해제" : "운영자로 지정",
        onPress: async () => {
          if (await confirm(u.isOperator ? "운영자 해제" : "운영자 지정", `${name} 님을 ${u.isOperator ? "일반 사용자로 바꿀까요?" : "운영자로 지정할까요? 모든 그룹과 사용자를 관리할 수 있게 돼요."}`, "변경"))
            void run(() => api("/api/operator/set-operator", { method: "PATCH", body: { userId: u.id, isOperator: !u.isOperator } }));
        },
      });
      options.push({
        label: "계정 삭제 (그룹 일정은 보존)",
        destructive: true,
        onPress: async () => {
          if (await confirm("계정 삭제", `${name} 님의 계정을 삭제할까요? 그룹 일정은 "삭제된 사용자" 이름으로 남아요. 되돌릴 수 없어요.`, "삭제", true))
            void run(() => api(`/api/admin/users/${u.id}`, { method: "DELETE", query: { groupDataAction: "preserve" } }), "삭제했어요");
        },
      });
      options.push({
        label: "계정과 그룹 일정 모두 삭제",
        destructive: true,
        onPress: async () => {
          if (await confirm("모두 삭제", `${name} 님의 계정과 이 사람이 만든 그룹 일정을 모두 삭제할까요? 되돌릴 수 없어요.`, "모두 삭제", true))
            void run(() => api(`/api/admin/users/${u.id}`, { method: "DELETE", query: { groupDataAction: "delete" } }), "삭제했어요");
        },
      });
    }
    if (options.length === 0) return;
    showSheet({ title: name, message: u.groupMembers.map((m) => `${m.group.name}(${m.group.leaderId === u.id ? "관리자" : roleLabel(m.role)})`).join(", ") || "소속 그룹 없음", options });
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      <TextInput
        accessibilityLabel="사용자 검색"
        value={query}
        onChangeText={setQuery}
        placeholder="이름, 이메일, 사번으로 검색"
        placeholderTextColor={c.muted}
        style={[type.body, { color: c.text, minHeight: 48, paddingHorizontal: 14, borderRadius: radius.control, backgroundColor: c.card }]}
      />
      {error || actionError ? <ErrorBanner message={(actionError ?? error)!} /> : null}
      {!data ? <Loading /> : null}
      {data ? (
        <Section title={`사용자 ${list.length}명`} footer="사용자를 누르면 그룹 추가, 운영자 지정, 삭제를 할 수 있어요.">
          {list.map((u) => (
            <Row
              key={u.id}
              label={`${u.name ?? "이름 없음"}${u.id === me?.id ? " (나)" : ""}`}
              value={[u.email, u.employeeId ? `사번 ${u.employeeId}` : null, u.groupMembers.map((m) => m.group.name).join(", ") || "그룹 없음"].filter(Boolean).join(" · ")}
              onPress={() => actions(u)}
              trailing={u.isOperator ? <Tag label="운영자" bg={c.primaryContainer} fg={c.onPrimaryContainer} /> : <View />}
            />
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}
