import { useState } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { QrPopup } from "@/components/QrPopup";
import { Empty, ErrorBanner, SecondaryButton, T } from "@/components/ui";
import { API_URL } from "@/lib/api";
import { useInviteQr } from "@/lib/useInviteQr";
import { permissionsFor } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

export default function InviteScreen() {
  const { c } = useTheme();
  const { group, me } = useSession();
  const p = permissionsFor(group, me);
  const groupId = group?.id ?? null;
  const { qr, left, scanned, error, loading, refresh } = useInviteQr(groupId, p.canQrInvite);
  const [qrWidth, setQrWidth] = useState(228);

  if (!group) return <QrPopup title="QR로 그룹 초대"><Empty title="선택된 그룹이 없어요" /></QrPopup>;
  if (!p.canQrInvite) return <QrPopup title="QR로 그룹 초대"><Empty title="초대 권한이 없어요" body="이 그룹의 승인된 멤버만 QR로 초대할 수 있어요." /></QrPopup>;

  const base = API_URL || "https://<서버 주소>";
  const url = qr && left > 0 ? `${base}/join/qr/${qr.token}` : null;
  const autoApprove = qr?.autoApprove ?? p.qrAutoApprove;

  return (
    <QrPopup title="QR로 그룹 초대">
      {error ? <ErrorBanner message={error} onRetry={() => void refresh()} /> : null}
      <T variant="headline" style={{ textAlign: "center" }}>{group.name}</T>
      <View onLayout={(e) => setQrWidth(Math.min(228, e.nativeEvent.layout.width))} style={{ alignItems: "center" }}>
        <View style={{ width: qrWidth, height: qrWidth, backgroundColor: "#FFFFFF", borderRadius: radius.control, alignItems: "center", justifyContent: "center" }}>
          {url ? <QRCode value={url} size={Math.max(1, qrWidth - 28)} /> : <T variant="footnote" color="#64748B">새 QR을 만들어 주세요</T>}
        </View>
      </View>
      <T variant="footnote" color={c.text2} style={{ textAlign: "center", fontVariant: ["tabular-nums"] }}>{qr && left > 0 ? `${left}초 남음` : scanned ? "사용 완료" : "사용할 수 있는 QR이 없어요"}</T>
      <T variant="subhead" color={c.text2}>
        {scanned ? "QR 코드가 사용됐어요. 다른 사람을 초대하려면 새로 만들어 주세요. " : "가입할 사람이 가입 정보 입력 후 초대 QR을 스캔하면 돼요. "}
        QR은 생성 후 1분 동안 한 번만 쓸 수 있고, 창을 닫으면 폐기돼요. 신규 회원은 운영자 승인이 필요해요. {autoApprove ? "기존 회원은 바로 그룹에 참가해요." : "기존 회원의 그룹 참가에는 그룹장·파트장의 승인이 필요해요."}
      </T>
      <SecondaryButton label={loading ? "QR 생성 중…" : "새 QR 만들기"} icon="qr" disabled={loading} onPress={() => void refresh()} />
    </QrPopup>
  );
}
