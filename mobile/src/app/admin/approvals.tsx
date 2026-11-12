import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { MiniButton, Row, Section } from "@/components/list";
import { Empty, ErrorBanner, Loading } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { dotted, toKey } from "@/lib/date";
import { useSession } from "@/lib/session";
import type { PendingUser } from "@/lib/types";
import { useData } from "@/lib/useData";
import { useTheme } from "@/theme/ThemeProvider";

export default function ApprovalsScreen() {
  const { c } = useTheme();
  const { me } = useSession();
  const { data, error, refreshing, refresh } = useData(me?.isOperator ? "admin:pending" : null, () => api<PendingUser[]>("/api/admin/pending"));
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!me?.isOperator) return <Empty title="운영자만 볼 수 있어요" />;

  async function act(u: PendingUser, action: "approve" | "reject") {
    if (action === "reject" && !(await confirm("가입 거절", `${u.name ?? u.email ?? "이 사용자"}의 계정을 삭제할까요?`, "거절", true))) return;
    setBusy(u.id);
    setActionError(null);
    try {
      await api("/api/admin/approve", { method: "POST", body: { userId: u.id, action } });
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      {error || actionError ? <ErrorBanner message={(actionError ?? error)!} /> : null}
      {!data ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="승인 대기 중인 계정이 없어요" body="아래로 당기면 새로고침돼요." /> : null}
      {data && data.length > 0 ? (
        <Section title={`승인 대기 ${data.length}명`} footer="승인하면 가입 승인 알림이 전달돼요. 거절하면 계정이 삭제돼요.">
          {data.map((u) => (
            <Row
              key={u.id}
              label={u.name ?? "이름 없음"}
              value={[u.email, u.employeeId ? `사번 ${u.employeeId}` : null, `${dotted(toKey(u.createdAt))} 가입`].filter(Boolean).join(" · ")}
              trailing={
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <MiniButton tone="danger" label="거절" disabled={busy === u.id} onPress={() => act(u, "reject")} />
                  <MiniButton label="승인" disabled={busy === u.id} onPress={() => act(u, "approve")} />
                </View>
              }
            />
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}
