import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useActionSheet, type SheetOption } from "@/components/ActionSheet";
import { MiniButton, Row, Section } from "@/components/list";
import { Empty, ErrorBanner, T, Tag } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { confirm, notice } from "@/lib/confirm";
import { permissionsFor, roleLabel } from "@/lib/permissions";
import { memberLabel, useSession } from "@/lib/session";
import type { AdminUser, GroupMember } from "@/lib/types";
import { useTheme } from "@/theme/ThemeProvider";

const ROLES = ["그룹장", "파트장", "MEMBER", "OBSERVER"] as const;

export default function MembersScreen() {
  const { c } = useTheme();
  const showSheet = useActionSheet();
  const { group, me, reloadGroups } = useSession();
  const p = permissionsFor(group, me);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group) return <Empty title="선택된 그룹이 없어요" />;

  const pending = group.members.filter((m) => m.status === "PENDING");
  const active = group.members.filter((m) => m.status !== "PENDING");

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await reloadGroups();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const patchMember = (m: GroupMember, body: object) => api(`/api/groups/${group.id}/members/${m.id}`, { method: "PATCH", body });

  function memberActions(m: GroupMember) {
    const isAdminMember = m.userId === group!.leaderId;
    const isMe = m.userId === me?.id;
    const options: SheetOption[] = [];
    if (p.canChangeRoles && !isAdminMember) {
      for (const role of ROLES) {
        if (role === (m.role ?? "MEMBER")) continue;
        options.push({ label: `역할: ${roleLabel(role)}(으)로 변경`, onPress: () => run(m.id, () => patchMember(m, { role })) });
      }
    }
    if (p.canGrantNotify && m.role !== "OBSERVER" && !isAdminMember) {
      options.push({
        label: m.canNotify ? "알림 보내기 권한 해제" : "알림 보내기 권한 주기",
        onPress: () => run(m.id, () => api("/api/admin/notify-permission", { method: "PATCH", body: { memberId: m.id, canNotify: !m.canNotify } })),
      });
    }
    if (p.canTransferAdmin && !isAdminMember && !isMe && m.status === "ACTIVE") {
      options.push({
        label: "그룹 관리자 넘기기",
        destructive: true,
        onPress: async () => {
          if (!(await confirm("그룹 관리자 넘기기", `${memberLabel(m)} 님에게 그룹 관리자 권한을 넘길까요?${p.isGroupAdmin ? " 내 관리자 권한은 없어져요." : ""}`, "넘기기", true))) return;
          void run(m.id, () =>
            p.isGroupAdmin
              ? api(`/api/groups/${group!.id}/leader`, { method: "PATCH", body: { newLeaderUserId: m.userId } })
              : api("/api/operator/transfer-leader", { method: "PATCH", body: { groupId: group!.id, newLeaderId: m.userId } }),
          );
        },
      });
    }
    if (p.canRemoveMembers && !isAdminMember && !isMe) {
      options.push({
        label: "그룹에서 내보내기",
        destructive: true,
        onPress: async () => {
          if (!(await confirm("멤버 내보내기", `${memberLabel(m)} 님을 ${group!.name}에서 내보낼까요?`, "내보내기", true))) return;
          void run(m.id, () => api(`/api/groups/${group!.id}/members/${m.id}`, { method: "DELETE" }));
        },
      });
    }
    if (options.length === 0) {
      notice(memberLabel(m), "이 멤버에 대해 바꿀 수 있는 항목이 없어요.");
      return;
    }
    showSheet({ title: memberLabel(m), message: `${isAdminMember ? "그룹 관리자" : roleLabel(m.role)}${m.canNotify ? " · 알림 권한" : ""}`, options });
  }

  // Operators add any registered user directly (same route as 사용자 관리).
  async function addMember() {
    setError(null);
    let users: AdminUser[];
    try {
      users = await api<AdminUser[]>("/api/admin/users");
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    const inGroup = new Set(group!.members.filter((m) => m.status === "ACTIVE").map((m) => m.userId));
    const candidates = users.filter((u) => !inGroup.has(u.id));
    if (candidates.length === 0) {
      notice("추가할 사용자가 없어요", "가입된 사용자가 모두 이 그룹에 있어요.");
      return;
    }
    showSheet({
      title: `${group!.name}에 멤버 추가`,
      options: candidates.map((u) => {
        const name = u.name ?? u.email ?? "사용자";
        return {
          label: u.employeeId ? `${name} · ${u.employeeId}` : name,
          onPress: () => run(u.id, () => api(`/api/admin/users/${u.id}/groups`, { method: "POST", body: { groupId: group!.id } })),
        };
      }),
    });
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await reloadGroups().catch(() => null);
            setRefreshing(false);
          }}
          tintColor={c.primary}
          colors={[c.primary]}
        />
      }
    >
      {error ? <ErrorBanner message={error} /> : null}

      {p.canAddMembers || p.canInviteCode || p.canQrInvite ? (
        <Section footer={p.canAddMembers ? "가입된 사용자를 바로 추가해요. 아직 가입 안 한 사람은 초대 코드로 초대하세요." : "초대 코드나 QR로 들어온 사람은 가입 요청에서 승인하면 돼요."}>
          {p.canAddMembers ? <Row icon="add" label="멤버 추가" onPress={addMember} chevron /> : null}
          {p.canInviteCode || p.canQrInvite ? <Row icon="link" label="초대 코드 · QR로 초대" onPress={() => router.push("/manage/invite")} chevron /> : null}
        </Section>
      ) : null}

      {p.canApproveJoin ? (
        <Section title={`가입 요청 ${pending.length}건`} footer={pending.length ? undefined : "새 가입 요청이 오면 여기에 표시돼요."}>
          {pending.map((m) => (
            <Row
              key={m.id}
              label={memberLabel(m)}
              value={m.user.email ?? undefined}
              trailing={
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <MiniButton
                    label="거절"
                    tone="danger"
                    disabled={busy === m.id}
                    onPress={async () => {
                      if (await confirm("가입 거절", `${memberLabel(m)} 님의 가입 요청을 거절할까요?`, "거절", true)) void run(m.id, () => patchMember(m, { status: "REJECTED" }));
                    }}
                  />
                  <MiniButton label="승인" disabled={busy === m.id} onPress={() => run(m.id, () => patchMember(m, { status: "ACTIVE" }))} />
                </View>
              }
            />
          ))}
        </Section>
      ) : null}

      <Section title={`멤버 ${active.length}명`} footer={p.canChangeRoles || p.canGrantNotify || p.canRemoveMembers ? "멤버를 누르면 역할·권한을 바꾸거나 그룹에서 내보낼 수 있어요." : undefined}>
        {active.map((m) => {
          const isAdminMember = m.userId === group.leaderId;
          return (
            <Row
              key={m.id}
              label={`${memberLabel(m)}${m.userId === me?.id ? " (나)" : ""}`}
              value={m.user.email ?? undefined}
              onPress={p.canChangeRoles || p.canGrantNotify || p.canTransferAdmin || p.canRemoveMembers ? () => memberActions(m) : undefined}
              trailing={
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  {m.canNotify ? <Tag label="알림" bg={c.warnContainer} fg={c.onWarn} /> : null}
                  <Tag label={isAdminMember ? "관리자" : roleLabel(m.role)} bg={isAdminMember ? c.primaryContainer : c.subtle} fg={isAdminMember ? c.onPrimaryContainer : c.text2} />
                </View>
              }
            />
          );
        })}
      </Section>

      <T variant="footnote" color={c.muted} style={{ fontWeight: "400", marginHorizontal: 4 }}>
        그룹장·파트장은 가입 요청을 처리할 수 있고, 역할 변경과 알림 권한은 그룹 관리자만 바꿀 수 있어요.
      </T>
    </ScrollView>
  );
}
