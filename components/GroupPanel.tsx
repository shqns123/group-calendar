"use client";

import { useState } from "react";
import { X, Copy, Check, Pencil, Trash2, UserMinus, RefreshCw, Crown, Save } from "lucide-react";

type Member = {
  id: string;
  userId: string;
  nickname: string | null;
  joinedAt: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  leaderId: string;
  leader: { id: string; name: string | null; email: string | null; image: string | null };
  members: Member[];
};

type Props = {
  group: Group;
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
};

export default function GroupPanel({ group, userId, onClose, onUpdated }: Props) {
  const isLeader = group.leaderId === userId;
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // 그룹 이름/설명 편집
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState(group.name);
  const [groupDescInput, setGroupDescInput] = useState(group.description ?? "");

  // 닉네임 편집
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");

  const copyInviteCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshInviteCode = async () => {
    if (!confirm("초대 코드를 재생성하면 기존 코드는 사용할 수 없습니다. 계속하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/invite`, { method: "POST" });
      if (res.ok) await onUpdated();
    } finally {
      setLoading(false);
    }
  };

  const saveGroupInfo = async () => {
    if (!groupNameInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupNameInput.trim(), description: groupDescInput.trim() }),
      });
      if (res.ok) {
        await onUpdated();
        setEditingGroupName(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const startEditNickname = (member: Member) => {
    setEditingMemberId(member.id);
    setNicknameInput(member.nickname ?? member.user.name ?? "");
  };

  const saveNickname = async (memberId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nicknameInput }),
      });
      if (res.ok) {
        await onUpdated();
        setEditingMemberId(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (!confirm(`${memberName}님을 그룹에서 제거하시겠습니까?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members/${memberId}`, { method: "DELETE" });
      if (res.ok) await onUpdated();
    } finally {
      setLoading(false);
    }
  };

  const transferLeader = async (targetUserId: string, targetName: string) => {
    if (!confirm(`"${targetName}"님에게 리더를 위임하시겠습니까?\n위임 후에는 리더 권한이 없어집니다.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/leader`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newLeaderUserId: targetUserId }),
      });
      if (res.ok) {
        await onUpdated();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async () => {
    if (!confirm(`"${group.name}" 그룹을 삭제하시겠습니까? 모든 일정도 삭제됩니다.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      if (res.ok) {
        await onUpdated();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-800">그룹 관리</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* ── 그룹 이름/설명 ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">그룹 정보</span>
              {isLeader && !editingGroupName && (
                <button
                  onClick={() => { setGroupNameInput(group.name); setGroupDescInput(group.description ?? ""); setEditingGroupName(true); }}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium"
                >
                  <Pencil className="w-3.5 h-3.5" /> 수정
                </button>
              )}
            </div>
            <div className="p-4">
              {editingGroupName ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    placeholder="그룹 이름"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    maxLength={30}
                  />
                  <input
                    type="text"
                    value={groupDescInput}
                    onChange={(e) => setGroupDescInput(e.target.value)}
                    placeholder="설명 (선택)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={60}
                  />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditingGroupName(false)} className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
                    <button onClick={saveGroupInfo} disabled={loading || !groupNameInput.trim()} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
                      <Save className="w-3.5 h-3.5" /> 저장
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-slate-800">{group.name}</p>
                  {group.description && <p className="text-sm text-slate-500 mt-0.5">{group.description}</p>}
                </div>
              )}
            </div>
          </div>

          {/* ── 초대 코드 ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">초대 코드</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-3">
              <code className="flex-1 font-mono text-slate-700 text-sm tracking-wider">{group.inviteCode}</code>
              <button onClick={copyInviteCode} className="text-slate-400 hover:text-slate-600 p-1" title="복사">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              {isLeader && (
                <button onClick={refreshInviteCode} disabled={loading} className="text-slate-400 hover:text-slate-600 p-1" title="재생성">
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ── 멤버 목록 ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">멤버 ({group.members.length}명)</span>
            </div>
            <div className="divide-y divide-slate-50">
              {group.members.map((member) => {
                const isCurrentUser = member.userId === userId;
                const isMemberLeader = member.userId === group.leaderId;
                const displayName = member.nickname || member.user.name || member.user.email?.split("@")[0] || "알 수 없음";

                return (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    {member.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.user.image} alt={displayName} className="w-8 h-8 rounded-full flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 text-sm font-semibold">{displayName.charAt(0).toUpperCase()}</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {editingMemberId === member.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={nicknameInput}
                            onChange={(e) => setNicknameInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveNickname(member.id); if (e.key === "Escape") setEditingMemberId(null); }}
                            className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={() => saveNickname(member.id)} disabled={loading} className="text-blue-600 text-xs font-medium">저장</button>
                          <button onClick={() => setEditingMemberId(null)} className="text-slate-400 text-xs">취소</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-slate-700 truncate">{displayName}</span>
                          {isMemberLeader && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">리더</span>
                          )}
                          {isCurrentUser && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">나</span>
                          )}
                          {member.nickname && (
                            <span className="text-xs text-slate-400 truncate">({member.user.name || member.user.email})</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    {editingMemberId !== member.id && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {(isLeader || isCurrentUser) && (
                          <button onClick={() => startEditNickname(member)} className="text-slate-300 hover:text-slate-500 p-1.5 rounded-lg hover:bg-slate-100" title="닉네임 수정">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isLeader && !isMemberLeader && (
                          <>
                            <button
                              onClick={() => transferLeader(member.userId, displayName)}
                              disabled={loading}
                              className="text-slate-300 hover:text-amber-500 p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                              title="리더 위임"
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeMember(member.id, displayName)}
                              disabled={loading}
                              className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="멤버 제거"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 위험 구역 ── */}
          {isLeader && (
            <div className="border border-red-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">위험 구역</span>
              </div>
              <div className="p-4">
                <button
                  onClick={deleteGroup}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  그룹 삭제
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
