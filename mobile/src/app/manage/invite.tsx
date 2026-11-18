import { useEffect, useState } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { QrPopup } from "@/components/QrPopup";
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
  const [qrWidth, setQrWidth] = useState(228);
  // Bumped to ask for a new code (button, timer, after a scan).
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!groupId || !p.canQrInvite) return;
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
  }, [groupId, round, p.canQrInvite]);

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

  if (!group) return <QrPopup title="QR로 그룹 초대"><Empty title="선택된 그룹이 없어요" /></QrPopup>;
  if (!p.canQrInvite) return <QrPopup title="QR로 그룹 초대"><Empty title="초대 권한이 없어요" body="이 그룹의 승인된 멤버만 QR로 초대할 수 있어요." /></QrPopup>;

  const base = API_URL || "https://<서버 주소>";
  const url = qr ? `${base}/join/qr/${qr.token}` : null;
  const autoApprove = qr?.autoApprove ?? p.qrAutoApprove;

  return (
    <QrPopup title="QR로 그룹 초대">
      {error ? <ErrorBanner message={error} onRetry={() => setRound((r) => r + 1)} /> : null}
      <T variant="headline" style={{ textAlign: "center" }}>{group.name}</T>
      <View onLayout={(e) => setQrWidth(Math.min(228, e.nativeEvent.layout.width))} style={{ alignItems: "center" }}>
        <View style={{ width: qrWidth, height: qrWidth, backgroundColor: "#FFFFFF", borderRadius: radius.control, alignItems: "center", justifyContent: "center" }}>
          {url ? <QRCode value={url} size={Math.max(1, qrWidth - 28)} /> : <T variant="footnote" color="#64748B">QR 코드 만드는 중…</T>}
        </View>
      </View>
      <T variant="footnote" color={c.text2} style={{ textAlign: "center", fontVariant: ["tabular-nums"] }}>{left}초 후 새 코드로 바뀌어요</T>
      <T variant="subhead" color={c.text2}>
        {scanned ? "방금 사용한 QR 코드를 새 코드로 바꿨어요. " : "가입할 사람이 휴대폰 카메라로 스캔하면 돼요. "}
        QR 코드는 한 번만 쓸 수 있어요. {autoApprove ? "이 코드로 가입하면 별도 승인이 필요 없어요." : "가입하려면 그룹장·파트장의 승인이 필요해요."}
      </T>
      <SecondaryButton label="지금 새 코드 받기" icon="sync" onPress={() => setRound((r) => r + 1)} />
    </QrPopup>
  );
}
