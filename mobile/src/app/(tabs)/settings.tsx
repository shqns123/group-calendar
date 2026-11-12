import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useActionSheet } from "@/components/ActionSheet";
import { Icon } from "@/components/Icon";
import { Row, Section } from "@/components/list";
import { ScreenHeader } from "@/components/ScreenHeader";
import { T } from "@/components/ui";
import { api, API_URL, DEMO, errorMessage } from "@/lib/api";
import { confirm, notice } from "@/lib/confirm";
import { googleSignOut } from "@/lib/google";
import { permissionsFor, roleLabel } from "@/lib/permissions";
import { groupOptions } from "@/lib/pickGroup";
import { myLabel, useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

export default function SettingsScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const showSheet = useActionSheet();
  const { me, group, groups, selectGroup, defaultGroupId, setDefaultGroup, reloadGroups, signOut } = useSession();
  const p = permissionsFor(group, me);
  const mine = group?.members.find((m) => m.userId === me?.id);
  const pendingJoin = group?.members.filter((m) => m.status === "PENDING").length ?? 0;
  const [syncing, setSyncing] = useState(false);

  const myRole = p.isGroupAdmin ? "그룹 관리자" : roleLabel(mine?.role);

  async function calendarSync() {
    if (!group) return;
    if (!(await confirm("캘린더 업로드", `${group.name} 일정을 GitLab 캘린더로 업로드할까요?`, "업로드"))) return;
    setSyncing(true);
    try {
      await api(`/api/groups/${group.id}/calendar-sync`, { method: "POST" });
      notice("업로드 완료", "GitLab 캘린더에 반영했어요.");
    } catch (e) {
      notice("업로드 실패", errorMessage(e));
    } finally {
      setSyncing(false);
    }
  }

  // Self-leave goes through the same member DELETE route as the web (the group admin can't leave).
  async function leaveGroup() {
    if (!group || !mine) return;
    if (!(await confirm("그룹 나가기", `${group.name}에서 나갈까요? 다시 들어오려면 초대 코드로 가입해야 해요.`, "나가기", true))) return;
    try {
      await api(`/api/groups/${group.id}/members/${mine.id}`, { method: "DELETE" });
      await reloadGroups();
      notice(`${group.name}에서 나갔어요`);
    } catch (e) {
      notice("나가지 못했어요", errorMessage(e));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="설정" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 40 }}>
        <Section title="내 정보">
          <Row
            compact
            icon="person"
            label={myLabel(group, me) || "이름 없음"}
            value={[group ? myRole : null, me?.isOperator ? "운영자" : null, me?.email ?? (me?.employeeId ? `사번 ${me.employeeId}` : null)].filter(Boolean).join(" · ")}
            onPress={group ? () => router.push("/profile") : undefined}
            chevron={!!group}
          />
        </Section>

        <Section title="그룹">
          <Row
            compact
            icon="calendar"
            label={group?.name ?? "그룹 없음"}
            value={groups.length > 1 ? `${groups.length}개 그룹 · 눌러서 전환` : undefined}
            onPress={groups.length > 1 ? () => showSheet({ title: "그룹 전환", options: groupOptions(groups, group?.id ?? null, selectGroup, defaultGroupId) }) : undefined}
            chevron={groups.length > 1}
          />
          {groups.length > 1 ? (
            <Row
              compact
              icon="check"
              label="기본 그룹"
              value={groups.find((g) => g.id === defaultGroupId)?.name ?? "지정 안 함 (첫 번째 그룹)"}
              onPress={() =>
                showSheet({
                  title: "기본 그룹 지정",
                  message: "앱을 열 때 이 그룹이 먼저 보여요.",
                  options: groups.map((g) => ({ label: g.name, selected: g.id === defaultGroupId, onPress: () => void setDefaultGroup(g.id) })),
                })
              }
              chevron
            />
          ) : null}
          <Row compact icon="join" label="초대 코드로 그룹 가입" onPress={() => router.push("/join")} chevron />
          {group && mine && group.leaderId !== me?.id ? <Row compact icon="logout" label={`${group.name} 나가기`} destructive onPress={leaveGroup} /> : null}
        </Section>

        {p.anyGroupManagement ? (
          <Section title="그룹 관리" footer="내 권한으로 할 수 있는 항목만 보여요.">
            {p.canApproveJoin || p.canChangeRoles || p.canGrantNotify ? (
              <Row
            compact
                icon="people"
                label="멤버 관리"
                value={pendingJoin ? `가입 요청 ${pendingJoin}건` : `${group?.members.filter((m) => m.status === "ACTIVE").length ?? 0}명`}
                onPress={() => router.push("/manage/members")}
                chevron
              />
            ) : null}
            {p.canInviteCode || p.canQrInvite ? <Row compact icon="link" label="초대 코드 · QR 초대" onPress={() => router.push("/manage/invite")} chevron /> : null}
            {p.canNotify ? <Row compact icon="send" label="알림 보내기 · 알림 일정" onPress={() => router.push("/manage/notify")} chevron /> : null}
            {p.canEditGroup ? <Row compact icon="settings" label="그룹 설정" value="이름, 장비, 캘린더 표시 개수" onPress={() => router.push("/manage/group")} chevron /> : null}
            {p.canCalendarSync ? <Row compact icon="sync" label={syncing ? "업로드 중…" : "GitLab 캘린더 업로드"} onPress={syncing ? undefined : calendarSync} /> : null}
          </Section>
        ) : null}

        {p.isOperator ? (
          <Section title="운영자" footer="운영자만 볼 수 있어요.">
            <Row compact icon="shield" label="가입 승인" onPress={() => router.push("/admin/approvals")} chevron />
            <Row compact icon="people" label="사용자 관리" onPress={() => router.push("/admin/users")} chevron />
            <Row compact icon="holiday" label="휴일 설정" value="회사 휴일 · 대체 근무일" onPress={() => router.push("/admin/holidays")} chevron />
            <Row compact icon="add" label="새 그룹 만들기" onPress={() => router.push("/admin/new-group")} chevron />
          </Section>
        ) : null}

        <Section title="앱 정보" footer="화면 모드는 휴대폰의 라이트/다크 설정을 따라가요.">
          <Row compact icon="info" label="서버" value={DEMO ? "예시 데이터 (데모 모드)" : API_URL.replace(/^https?:\/\//, "")} />
          <Row compact icon="note" label="버전" value={`${Constants.expoConfig?.version ?? "1.0.0"} · ${String(Constants.expoConfig?.extra?.appVariant ?? "")}`} />
        </Section>

        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await googleSignOut();
            await signOut();
          }}
          style={({ pressed }) => ({ minHeight: 56, borderRadius: radius.control, backgroundColor: pressed ? c.fill : c.card, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" })}
        >
          <Icon name="logout" size={20} color={c.danger} />
          <T variant="headline" color={c.danger}>
            로그아웃
          </T>
        </Pressable>
      </ScrollView>
    </View>
  );
}
