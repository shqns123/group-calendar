"use client";

import { useEffect, useId, useRef, useState } from "react";
import { QrCode, ScanLine, ArrowLeft } from "lucide-react";

export default function SignupQrStep({ accountLabel, onScan, onBack, busy, error }: {
  accountLabel: string; onScan: (value: string) => Promise<void>; onBack: () => void; busy: boolean; error: string;
}) {
  const id = `signup-qr-${useId().replace(/:/g, "")}`;
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let handled = false;
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let start: Promise<unknown> | undefined;
    void import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      scanner = new Html5Qrcode(id);
      start = scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, (value) => {
        if (cancelled || handled) return;
        handled = true;
        setScanning(false);
        void onScanRef.current(value);
      }, () => {});
      return start;
    }).catch(() => {
      if (!cancelled) {
        setCameraError("카메라를 시작할 수 없어요. 카메라 권한을 허용한 뒤 다시 스캔해 주세요.");
        setScanning(false);
      }
    });
    return () => {
      cancelled = true;
      // Also stop a camera whose async start finished after the component unmounted.
      void start?.then(() => scanner?.stop()).catch(() => {});
    };
  }, [scanning, id]);

  return (
    <section aria-label="초대 QR 확인" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <QrCode size={32} aria-hidden color="var(--accent)" />
        <div>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>초대 QR을 확인해 주세요</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: 4 }}>{accountLabel}</p>
        </div>
      </div>
      <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
        그룹 멤버에게 초대 QR 창을 열어 달라고 요청해 주세요. 스캔이 확인되면 운영자에게 가입 승인 요청을 보냅니다.
      </p>
      {scanning && <div id={id} style={{ width: "100%", minHeight: 260, overflow: "hidden", borderRadius: 12 }} />}
      {(error || cameraError) && <p role="alert" style={{ fontSize: "0.875rem", color: "#B91C1C", lineHeight: 1.5 }}>{error || cameraError}</p>}
      <button type="button" disabled={busy || scanning} onClick={() => { setCameraError(""); setScanning(true); }}
        style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", minHeight: 52, padding: "12px 16px", borderRadius: 8,
          border: "none", background: "var(--accent-hover)", color: "#fff", cursor: busy || scanning ? "default" : "pointer", fontFamily: "inherit", fontSize: "0.875rem", fontWeight: 600, opacity: busy || scanning ? 0.6 : 1 }}>
        <ScanLine size={22} aria-hidden />{busy ? "초대 확인 및 요청 중…" : scanning ? "QR 코드를 비춰 주세요" : "초대 QR 스캔"}
      </button>
      <p style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>QR은 생성 후 1분 동안 한 번만 사용할 수 있어요. 초대 창을 닫으면 사용할 수 없어요.</p>
      <button type="button" disabled={busy} onClick={() => { setScanning(false); onBack(); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit" }}>
        <ArrowLeft size={18} aria-hidden />가입 정보로 돌아가기
      </button>
    </section>
  );
}
