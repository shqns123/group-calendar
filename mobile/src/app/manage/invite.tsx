import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Section } from "@/components/list";
import { Empty, ErrorBanner, SecondaryButton, T } from "@/components/ui";
import { api, API_URL, errorMessage } from "@/lib/api";
import { permissionsFor } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

type Issued = { token: string; autoApprove: boolean; refreshSeconds?: number };

/**
 * The group's join QR. Every code works once and only for about a minute: a new one comes every
 * minute, and right after someone scans the current one.
 */
export default function InviteScreen() {
  const { c } = useTheme();
  const { group, me } = useSession();
  const p = permissionsFor(group, me);
  const groupId = group?.id ?? null;
  const [qr, setQr] = useState<Issued | null>(null);
  const [left, setLeft] = useState(60);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped to ask for a new code (button, timer, after a scan).
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    let live = true;
    void (async () => {
      try {
        const res = await api<Issued>(`/api/groups/${groupId}/qr-invite`, { method: "POST" });
        if (!live) return;
        setQr(res);
        setLeft(res.refreshSeconds ?? 60);
        setError(null);
      } catch (e) {
        if (live) setError(errorMessage(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [groupId, round]);

  // The countdown for the code on screen; at zero, a new code.
  useEffect(() => {
    if (!qr) return;
    const until = Date.now() + (qr.refreshSeconds ?? 60) * 1000;
    const tick = setInterval(() => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(tick);
        setRound((r) => r + 1);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [qr]);

  // Someone scanned it: show that, and replace it at once.
  const token = qr?.token ?? null;
  useEffect(() => {
    if (!groupId || !token) return;
    const poll = setInterval(async () => {
      const res = await api<{ scanned: boolean }>(`/api/groups/${groupId}/qr-invite`, { query: { token } }).catch(() => null);
      if (res?.scanned) {
        setScanned(true);
        setRound((r) => r + 1);
      }
    }, 4000);
    return () => clearInterval(poll);
  }, [groupId, token]);

  if (!group) return <Empty title="선택된 그룹이 없어요" />;
  if (!p.canQrInvite) return <Empty title="초대 권한이 없어요" body="이 그룹의 승인된 멤버만 QR로 초대할 수 있어요." />;

  const base = API_URL || "https://<서버 주소>";
  const url = qr ? `${base}/join/qr/${qr.token}` : null;
  const autoApprove = qr?.autoApprove ?? p.qrAutoApprove;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 40 }}>
      {error ? <ErrorBanner message={error} onRetry={() => setRound((r) => r + 1)} /> : null}

      <Section
        title={`${group.name} QR 초대`}
        footer={`QR 코드는 한 번만 쓸 수 있고 1분마다 바뀌어요. ${autoApprove ? "이 QR로 가입하면 승인 없이 바로 멤버가 돼요." : "이 QR로 가입하면 그룹장·파트장의 승인이 필요해요."}`}
      >
        <View style={{ padding: 20, gap: 14, alignItems: "center" }}>
          <T variant="subhead" color={scanned ? c.primary : c.text2} style={{ textAlign: "center" }}>
            {scanned ? "방금 QR 코드가 사용됐어요. 새 코드로 바꿨어요." : "가입할 사람이 앱의 「QR 스캔으로 그룹 가입」이나 휴대폰 카메라로 스캔하면 돼요."}
          </T>
          <View style={{ padding: 14, backgroundColor: "#FFFFFF", borderRadius: radius.control, width: 228, height: 228, alignItems: "center", justifyContent: "center" }}>
            {url ? <QRCode value={url} size={200} /> : <T variant="footnote" color="#64748B">QR 코드 만드는 중…</T>}
          </View>
          <T variant="footnote" color={c.text2} style={{ fontVariant: ["tabular-nums"] }}>
            {`${left}초 후 새 코드로 바뀌어요`}
          </T>
          <SecondaryButton label="지금 새 코드 받기" icon="sync" onPress={() => setRound((r) => r + 1)} />
        </View>
      </Section>
    </ScrollView>
  );
}
