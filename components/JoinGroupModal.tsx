"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, RefreshCw, X } from "lucide-react";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";

type Props = {
  onClose: () => void;
  onJoined: (groupId: string) => void;
};

export default function JoinGroupModal({ onClose, onJoined }: Props) {
  const [step, setStep] = useState<"code" | "nickname" | "pending">("code");
  // The scanned QR (its URL); joining by invite code is gone.
  const [qr, setQr] = useState("");
  const [nickname, setNickname] = useState("");
  const [groupName, setGroupName] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(true);
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const startedRef = useRef(false);

  const submitCode = useCallback(async (scanned: string) => {
    if (!scanned) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: scanned, checkOnly: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "유효하지 않은 QR 코드입니다.");
        return;
      }

      setQr(scanned);
      setGroupName(data.groupName);
      setAutoApprove(!!data.autoApprove);
      setStep("nickname");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;

    void import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      startedRef.current = false;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            const code = decoded.trim();
            setScanning(false);
            void submitCode(code);
          },
          () => {}
        )
        .then(() => {
          startedRef.current = true;
        })
        .catch(() => {
          if (!cancelled) {
            setError("카메라를 시작할 수 없습니다. 권한을 확인해 주세요.");
            setScanning(false);
          }
          scannerRef.current = null;
        });
    });

    return () => {
      cancelled = true;
      if (startedRef.current && scannerRef.current) {
        void scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
      startedRef.current = false;
    };
  }, [scanning, submitCode]);

  const stopScan = () => {
    setScanning(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: qr,
          nickname: nickname.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "참가 요청에 실패했습니다.");
        return;
      }

      if (data.pending) {
        setStep("pending");
        return;
      }

      onJoined(data.groupId);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800">그룹 참가</h3>
          <button
            onClick={() => {
              stopScan();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "pending" ? (
          <div className="space-y-4 p-6 text-center">
            <div className="flex justify-center py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">{groupName}</p>
              <p className="mt-2 text-sm text-slate-500">참가 요청이 전송되었습니다.</p>
              <p className="text-sm text-slate-500">관리자 승인 후 그룹에 들어갈 수 있습니다.</p>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white"
            >
              확인
            </button>
          </div>
        ) : step === "code" ? (
          <div className="space-y-4 p-6">
            <p className="text-center text-sm text-slate-500">그룹 멤버의 화면에 있는 그룹 QR 코드를 카메라로 비춰 주세요.</p>
            {scanning ? (
              <div id="qr-reader" className="w-full overflow-hidden rounded-xl" />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setScanning(true);
                }}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {loading ? "확인 중..." : "다시 스캔"}
              </button>
            )}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-500">{error}</p>}
            <p className="text-center text-xs text-slate-400">QR 코드는 1분마다 바뀌고 한 번만 쓸 수 있어요.</p>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4 p-6">
            <div className="rounded-xl bg-blue-50 p-4 text-center">
              <p className="mb-1 text-xs font-medium text-blue-500">참가할 그룹</p>
              <p className="text-lg font-bold text-blue-800">{groupName}</p>
              <p className="mt-1 text-xs text-blue-600">{autoApprove ? "승인 없이 바로 가입돼요." : "그룹장·파트장이 승인하면 가입돼요."}</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                닉네임<span className="font-normal text-slate-400">(선택)</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="이 그룹에서 사용할 닉네임"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                maxLength={20}
              />
              <p className="mt-1.5 text-xs text-slate-400">비워두면 계정 이름을 사용합니다.</p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-500">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep("code");
                  setError("");
                  setScanning(true);
                }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "참가 중..." : "참가하기"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
