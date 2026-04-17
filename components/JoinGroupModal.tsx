"use client";

import { useState } from "react";
import { X, Users, ArrowRight, Clock } from "lucide-react";

type Props = {
  onClose: () => void;
  onJoined: (groupId: string) => void;
};

export default function JoinGroupModal({ onClose, onJoined }: Props) {
  const [step, setStep] = useState<"code" | "nickname" | "pending">("code");
  const [inviteCode, setInviteCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [joinRole, setJoinRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1단계: 초대 코드 확인
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError("초대 코드를 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteCode.trim(), checkOnly: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "유효하지 않은 초대 코드입니다");
        return;
      }

      setGroupName(data.groupName);
      setGroupId(data.groupId);
      setJoinRole(data.role ?? "MEMBER");
      setStep("nickname");
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 2단계: 닉네임 설정 후 참가
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
        setError(data.error || "참가에 실패했습니다");
        return;
      }

      if (data.pending) {
        setStep("pending");
        return;
      }
      onJoined(data.groupId);
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">그룹 참가</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "pending" ? (
          <div className="p-6 space-y-4 text-center">
            <div className="flex justify-center py-4">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">{groupName}</p>
              <p className="text-sm text-slate-500 mt-2">가입 요청이 전송되었습니다.</p>
              <p className="text-sm text-slate-500">관리자의 수락을 기다려 주세요.</p>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold"
            >
              확인
            </button>
          </div>
        ) : step === "code" ? (
          <form onSubmit={handleCodeSubmit} className="p-6 space-y-4">
            <div className="flex justify-center py-4">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <p className="text-sm text-slate-500 text-center">
              리더에게 받은 초대 코드를 입력하세요
            </p>

            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="초대 코드 입력"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono text-lg tracking-wider"
              autoFocus
            />

            {error && (
              <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg text-center">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium border border-slate-200"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-semibold disabled:opacity-50"
              >
                {loading ? "확인 중..." : <>다음 <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="p-6 space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-xs text-blue-500 font-medium mb-1">참가할 그룹</p>
              <p className="text-lg font-bold text-blue-800">{groupName}</p>
              {joinRole !== "MEMBER" && (
                <p className="text-xs text-blue-600 mt-1">
                  역할: <strong>{joinRole}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                닉네임 <span className="text-slate-400 font-normal">(선택)</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="이 그룹에서 사용할 닉네임"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                maxLength={20}
              />
              <p className="text-xs text-slate-400 mt-1.5">
                비워두면 계정 이름이 사용됩니다
              </p>
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg text-center">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep("code"); setError(""); }}
                className="flex-1 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium border border-slate-200"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-semibold disabled:opacity-50"
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
