import * as Linking from "expo-linking";
import { useState } from "react";
import { ScrollView, Share, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { MiniButton, Row, Section } from "@/components/list";
import { Empty, ErrorBanner, PrimaryButton, T } from "@/components/ui";
import { api, API_URL, errorMessage } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { permissionsFor } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

export default function InviteScreen() {
  const { c } = useTheme();
  const { group, me, reloadGroups } = useSession();
  const p = permissionsFor(group, me);
  const [code, setCode] = useState(group?.inviteCode ?? "");
  const [qr, setQr] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group) return <Empty title="선택된 그룹이 없어요" />;

  const base = API_URL || "https://<서버 주소>";

  async function regenerate() {
    if (!(await confirm("초대 코드 다시 만들기", "지금 코드는 더 이상 쓸 수 없게 돼요.", "다시 만들기", true))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ inviteCode: string }>(`/api/groups/${group!.id}/invite`, { method: "POST" });
      setCode(res.inviteCode);
      await reloadGroups();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function makeQr() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; expiresAt: string }>(`/api/groups/${group!.id}/qr-invite`, { method: "POST" });
      setQr({ url: `${base}/join/qr/${res.token}`, expiresAt: res.expiresAt });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const share = (message: string) => Share.share({ message }).catch(() => null);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 40 }}>
      {error ? <ErrorBanner message={error} /> : null}

      {code ? (
        <Section title="초대 코드" footer="앱 설정 › 초대 코드로 그룹 가입, 또는 웹에서 이 코드를 입력하면 가입 요청이 와요.">
          <View style={{ padding: 16, gap: 12, alignItems: "center" }}>
            <T variant="title1" selectable style={{ letterSpacing: 4 }}>
              {code}
            </T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <MiniButton tone="neutral" label="공유" onPress={() => share(`${group.name} 그룹 초대 코드: ${code}\n${base}/join/${code}`)} />
              {p.canInviteCode ? <MiniButton tone="danger" label="다시 만들기" disabled={busy} onPress={regenerate} /> : null}
            </View>
          </View>
        </Section>
      ) : null}

      {p.canQrInvite ? (
        <Section title="QR 초대" footer="QR 링크는 7일 동안 쓸 수 있어요. 찍으면 웹 가입 화면이 열려요.">
          {qr ? (
            <View style={{ padding: 16, gap: 12, alignItems: "center" }}>
              <View style={{ padding: 12, backgroundColor: "#FFFFFF", borderRadius: radius.control }}>
                <QRCode value={qr.url} size={200} />
              </View>
              <T variant="footnote" color={c.text2}>
                {`만료: ${new Date(qr.expiresAt).toLocaleDateString("ko-KR")}`}
              </T>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <MiniButton tone="neutral" label="링크 공유" onPress={() => share(`${group.name} 그룹 초대 링크\n${qr.url}`)} />
                <MiniButton tone="neutral" label="열기" onPress={() => Linking.openURL(qr.url)} />
              </View>
            </View>
          ) : (
            <View style={{ padding: 16 }}>
              <PrimaryButton label="QR 초대 만들기" busy={busy} onPress={makeQr} />
            </View>
          )}
        </Section>
      ) : null}

      {!code && !p.canQrInvite ? (
        <Section>
          <Row label="초대 권한이 없어요" value="그룹장·파트장에게 초대 코드를 요청해 주세요." />
        </Section>
      ) : null}
    </ScrollView>
  );
}
