import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { QrPopup } from "@/components/QrPopup";
import { closeScreen } from "@/lib/nav";
import { Field, Section } from "@/components/list";
import { ErrorBanner, PrimaryButton, SecondaryButton, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { notice } from "@/lib/confirm";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

/** The token in a group QR (`…/join/qr/<token>`), or null for any other code. */
function qrToken(data: string) {
  return data.match(/\/join\/qr\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

type Found = { token: string; groupId: string; groupName: string; autoApprove: boolean };

/**
 * Join a group by scanning a member's group QR. The scan holds the code for this user while they
 * pick a nickname; codes from an operator / group admin / 그룹장 / 파트장 join without approval.
 */
export default function JoinScreen() {
  const { c } = useTheme();
  const { reloadGroups, selectGroup } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [found, setFound] = useState<Found | null>(null);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The camera reports the same code many times a second; handle one at a time.
  const handling = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function onScanned({ data }: BarcodeScanningResult) {
    if (handling.current || found) return;
    handling.current = true;
    const token = qrToken(data);
    if (!token) {
      setError("그룹 QR 코드가 아니에요. 그룹 멤버의 「QR로 그룹 초대」 화면을 스캔해 주세요.");
      setTimeout(() => {
        handling.current = false;
      }, 1500);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<Omit<Found, "token">>("/api/groups/join", { method: "POST", body: { token, checkOnly: true } });
      setFound({ ...res, token });
    } catch (e) {
      setError(errorMessage(e));
      // Let the camera try again shortly (a new code, or the same person's new one).
      setTimeout(() => {
        handling.current = false;
      }, 1500);
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!found) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ groupId: string; groupName: string; pending?: boolean }>("/api/groups/join", {
        method: "POST",
        body: { token: found.token, nickname: nickname.trim() },
      });
      await reloadGroups();
      if (res.pending) {
        notice("가입 요청을 보냈어요", `${res.groupName} 그룹장·파트장이 승인하면 그룹 일정을 볼 수 있어요.`);
      } else {
        selectGroup(res.groupId);
        notice("그룹에 가입했어요", `이제 ${res.groupName} 그룹 일정을 볼 수 있어요.`);
      }
      if (mounted.current) closeScreen(router, "/settings");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function rescan() {
    setFound(null);
    setError(null);
    handling.current = false;
  }

  if (found) {
    return (
      <QrPopup title="QR로 그룹 가입">
        {error ? <ErrorBanner message={error} /> : null}
        <Section title="가입할 그룹" footer={found.autoApprove ? "승인 없이 바로 가입돼요." : "그룹장·파트장이 승인하면 가입돼요."}>
          <View style={{ padding: 16 }}>
            <T variant="title2">{found.groupName}</T>
          </View>
        </Section>
        <Field label="닉네임 (선택)" value={nickname} onChangeText={setNickname} maxLength={30} hint="그룹 안에서 표시될 이름이에요. 비우면 계정 이름을 써요." />
        <PrimaryButton label={found.autoApprove ? "가입하기" : "가입 요청"} busy={busy} onPress={join} />
        <SecondaryButton label="다시 스캔" onPress={rescan} disabled={busy} />
      </QrPopup>
    );
  }

  return (
    <QrPopup title="QR로 그룹 가입">
      <T variant="subhead" color={c.text2}>
        그룹 멤버의 설정 › 「QR로 그룹 초대」 화면에 있는 QR 코드를 비춰 주세요. QR 코드는 1분마다 바뀌고 한 번만 쓸 수 있어요.
      </T>
      {error ? <ErrorBanner message={error} /> : null}
      {!permission ? null : permission.granted ? (
        <View style={{ aspectRatio: 1, borderRadius: radius.card, overflow: "hidden", backgroundColor: "#000" }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={busy ? undefined : onScanned} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <T variant="body">QR 코드를 스캔하려면 카메라 권한이 필요해요.</T>
          <PrimaryButton label="카메라 허용" icon="check" onPress={() => void requestPermission()} />
        </View>
      )}
    </QrPopup>
  );
}
