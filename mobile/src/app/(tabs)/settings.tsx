import type { ReactNode } from "react";
import Constants from "expo-constants";
import { Pressable, ScrollView, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { ScreenHeader } from "@/components/ScreenHeader";
import { T } from "@/components/ui";
import { API_URL, DEMO } from "@/lib/api";
import { googleSignOut } from "@/lib/google";
import { pickGroup } from "@/lib/pickGroup";
import { myLabel, useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

export default function SettingsScreen() {
  const { c } = useTheme();
  const { me, group, groups, selectGroup, signOut } = useSession();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="설정" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        <Section title="내 정보">
          <Row icon="person" label={myLabel(group, me) || "이름 없음"} value={me?.email ?? (me?.employeeId ? `사번 ${me.employeeId}` : undefined)} />
        </Section>

        <Section title="그룹">
          <Row
            icon="calendar"
            label={group?.name ?? "그룹 없음"}
            value={groups.length > 1 ? `${groups.length}개 그룹 중` : undefined}
            onPress={groups.length > 1 ? () => pickGroup(groups, group?.id ?? null, selectGroup) : undefined}
            action="전환"
          />
        </Section>

        <Section title="앱 정보" footer="화면 모드는 휴대폰의 라이트/다크 설정을 따라가요. 그룹 생성, 초대, 관리자 기능은 웹에서 이용해 주세요.">
          <Row icon="settings" label="서버" value={DEMO ? "예시 데이터 (데모 모드)" : API_URL.replace(/^https?:\/\//, "")} />
          <Row icon="note" label="버전" value={`${Constants.expoConfig?.version ?? "1.0.0"} · ${String(Constants.expoConfig?.extra?.appVariant ?? "")}`} />
        </Section>

        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await googleSignOut();
            await signOut();
          }}
          style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.card, borderWidth: 1, borderColor: c.outline, backgroundColor: pressed ? c.subtle : c.card, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" })}
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

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="footnote" color={c.text2} accessibilityRole="header" style={{ marginLeft: 4 }}>
        {title}
      </T>
      <View style={{ backgroundColor: c.card, borderRadius: radius.card, borderWidth: 1, borderColor: c.outline, overflow: "hidden" }}>{children}</View>
      {footer ? (
        <T variant="footnote" color={c.muted} style={{ marginHorizontal: 4, fontWeight: "400" }}>
          {footer}
        </T>
      ) : null}
    </View>
  );
}

function Row({ icon, label, value, onPress, action }: { icon: IconName; label: string; value?: string; onPress?: () => void; action?: string }) {
  const { c } = useTheme();
  const body = (
    <View style={{ minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: c.outline }}>
      <Icon name={icon} size={22} color={c.text2} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="body">{label}</T>
        {value ? (
          <T variant="footnote" color={c.text2} style={{ fontWeight: "400" }}>
            {value}
          </T>
        ) : null}
      </View>
      {onPress && action ? (
        <T variant="subhead" color={c.primaryText} style={{ fontWeight: "600" }}>
          {action}
        </T>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${action}`} onPress={onPress}>
      {body}
    </Pressable>
  );
}
