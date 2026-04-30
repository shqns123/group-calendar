"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Clock, Keyboard, Users, X } from "lucide-react";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";

type Props = {
  onClose: () => void;
  onJoined: (groupId: string) => void;
};

export default function JoinGroupModal({ onClose, onJoined }: Props) {
  const [step, setStep] = useState<"code" | "nickname" | "pending">("code");
  const [inviteCode, setInviteCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [groupName, setGroupName] = useState("");
  const [joinRole, setJoinRole] = useState("MEMBER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const startedRef = useRef(false);

  const submitCode = useCallback(async (code: string) => {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError("초대 코드를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: normalizedCode, checkOnly: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "유효하지 않은 초대 코드입니다.");
        return;
      }

      setInviteCode(normalizedCode);
      setGroupName(data.groupName);
      setJoinRole(data.role ?? "MEMBER");
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
            setError("카메라를 시작할 수 없습니다. 권한을 확인해주세요.");
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

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCode(inviteCode);
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
          inviteCode: inviteCode.trim(),
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
            <div className="flex overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={stopScan}
                className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  !scanning ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Keyboard className="h-4 w-4" />
                직접 입력
              </button>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setScanning(true);
                }}
                className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  scanning ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Camera className="h-4 w-4" />
                QR 스캔
              </button>
            </div>

            {scanning ? (
              <div className="space-y-3">
                <div id="qr-reader" className="w-full overflow-hidden rounded-xl" />
                <p className="text-center text-xs text-slate-400">카메라로 초대 QR 코드를 비춰주세요.</p>
              </div>
            ) : (
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="flex justify-center py-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                    <Users className="h-7 w-7 text-blue-500" />
                  </div>
                </div>
                <p className="text-center text-sm text-slate-500">리더에게 받은 초대 코드를 입력하세요.</p>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="초대 코드 입력"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-mono text-lg tracking-wider text-slate-800 placeholder:text-sm placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-500">{error}</p>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? "확인 중..." : <>다음 <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </form>
            )}

            {scanning && error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-500">{error}</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4 p-6">
            <div className="rounded-xl bg-blue-50 p-4 text-center">
              <p className="mb-1 text-xs font-medium text-blue-500">참가할 그룹</p>
              <p className="text-lg font-bold text-blue-800">{groupName}</p>
              {joinRole !== "MEMBER" && (
                <p className="mt-1 text-xs text-blue-600">
                  역할: <strong>{joinRole}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                닉네임 <span className="font-normal text-slate-400">(선택)</span>
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
