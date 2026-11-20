import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, View } from "react-native";
import { ErrorBanner, PrimaryButton, SecondaryButton, T } from "./ui";
import { Icon } from "./Icon";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

export function SignupQrStep({ accountLabel, onScan, onBack, busy, error }: {
  accountLabel: string; onScan: (qr: string) => Promise<void>; onBack: () => void; busy: boolean; error: string | null;
}) {
  const { c } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const handled = useRef(false);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") setScanning(false); });
    return () => listener.remove();
  }, []);

  async function start() {
    setCameraError(null);
    try {
      const result = permission?.granted ? permission : await requestPermission();
      if (result.granted) { handled.current = false; setScanning(true); }
      else setCameraError("QR을 스캔하려면 카메라 권한이 필요해요. 기기 또는 브라우저 설정에서 허용해 주세요.");
    } catch { setCameraError("카메라를 시작하지 못했어요. 권한을 확인하고 다시 시도해 주세요."); }
  }

  function scanned({ data }: BarcodeScanningResult) {
    if (handled.current || busy) return;
    handled.current = true;
    setScanning(false);
    if (!/\/join\/qr\/[A-Za-z0-9_-]+/.test(data)) {
      setCameraError("그룹 초대 QR이 아니에요. 그룹 멤버의 초대 화면을 다시 스캔해 주세요.");
      return;
    }
    void onScan(data);
  }

  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Icon name="qr" size={32} color={c.primaryText} />
      <T variant="title2" accessibilityRole="header" style={{ flex: 1 }}>초대 QR을 확인해 주세요</T>
    </View>
    <T variant="body" color={c.text2}>{accountLabel}</T>
    <T variant="body" color={c.text2}>그룹 멤버에게 초대 QR 창을 열어 달라고 요청해 주세요. 스캔이 확인되면 운영자에게 가입 승인 요청을 보냅니다.</T>
    {scanning && permission?.granted ? <View style={{ aspectRatio: 1, borderRadius: radius.card, overflow: "hidden", backgroundColor: "#000" }}>
      <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanned}
        onMountError={() => { setScanning(false); setCameraError("카메라를 시작하지 못했어요. 권한을 확인해 주세요."); }} />
    </View> : null}
    {error || cameraError ? <ErrorBanner message={error || cameraError!} /> : null}
    <PrimaryButton label={busy ? "초대 확인 및 요청 중…" : scanning ? "QR 코드를 비춰 주세요" : "초대 QR 스캔"} icon="qr" busy={busy} disabled={scanning} onPress={() => void start()} />
    {permission?.canAskAgain === false && !permission.granted && Platform.OS !== "web" ? <SecondaryButton label="카메라 권한 설정 열기" onPress={() => void Linking.openSettings()} /> : null}
    <T variant="footnote" color={c.text2}>QR은 생성 후 1분 동안 한 번만 사용할 수 있어요. 초대 창을 닫으면 사용할 수 없어요.</T>
    <SecondaryButton label="가입 정보로 돌아가기" icon="back" disabled={busy} onPress={onBack} />
  </View>;
}
