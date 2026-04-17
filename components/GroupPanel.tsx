"use client";

import { useState } from "react";
import { X, Pencil, Trash2, UserMinus, Save, ShieldCheck } from "lucide-react";

type Member = {
  id: string;
  userId: string;
  nickname: string | null;
  role: string;
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

const ROLE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  관리자: { label: "관리자", bg: "var(--text-primary)", color: "var(--surface)" },
  그룹장: { label: "그룹장", bg: "var(--accent-light)", color: "var(--accent)" },
  파트장: { label: "파트장", bg: "#F0FDF4", color: "#16A34A" },
  MEMBER: { label: "멤버", bg: "var(--surface-raised)", color: "var(--text-tertiary)" },
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_LABELS[role] ?? ROLE_LABELS.MEMBER;
  return (
    <span
      style={{
        fontSize: "0.65rem",
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 4,
        background: config.bg,
        color: config.color,
        letterSpacing: "0.01em",
        flexShrink: 0,
      }}
    >
      {config.label}
    </span>
  );
}

export default function GroupPanel({ group, userId, onClose, onUpdated }: Props) {
  const isAdmin = group.leaderId === userId;
  const myMember = group.members.find((m) => m.userId === userId);
  const isLeader = isAdmin || myMember?.role === "그룹장" || myMember?.role === "파트장";

  const [loading, setLoading] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState(group.name);
  const [groupDescInput, setGroupDescInput] = useState(group.description ?? "");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null);

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

  const setMemberRole = async (member: Member, role: string, displayName: string) => {
    const roleLabel = role === "그룹장" ? "그룹장" : role === "파트장" ? "파트장" : "일반 멤버";
    if (!confirm(`"${displayName}"님을 ${roleLabel}로 변경하시겠습니까?`)) return;
    setRoleMenuId(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) await onUpdated();
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

  const sectionStyle: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 10,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px",
    background: "var(--surface-raised)",
    borderBottom: "1px solid var(--border-subtle)",
    borderRadius: "10px 10px 0 0",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "var(--text-tertiary)",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "14px 14px 0 0",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px 14px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.9rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            그룹 관리
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "flex", padding: 2 }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ── 그룹 정보 ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <span style={labelStyle}>그룹 정보</span>
              {isAdmin && !editingGroupName && (
                <button
                  onClick={() => { setGroupNameInput(group.name); setGroupDescInput(group.description ?? ""); setEditingGroupName(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--accent)", fontWeight: 500, fontFamily: "inherit" }}
                >
                  수정
                </button>
              )}
            </div>
            <div style={{ padding: "12px 14px" }}>
              {editingGroupName ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    type="text"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    placeholder="그룹 이름"
                    autoFocus
                    maxLength={30}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 7, fontSize: "0.85rem", outline: "none", fontFamily: "inherit", color: "var(--text-primary)", background: "var(--surface)" }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                  <input
                    type="text"
                    value={groupDescInput}
                    onChange={(e) => setGroupDescInput(e.target.value)}
                    placeholder="설명 (선택)"
                    maxLength={60}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 7, fontSize: "0.85rem", outline: "none", fontFamily: "inherit", color: "var(--text-primary)", background: "var(--surface)" }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditingGroupName(false)} style={{ flex: 1, padding: "7px", fontSize: "0.8rem", border: "1px solid var(--border)", borderRadius: 6, background: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text-secondary)" }}>취소</button>
                    <button onClick={saveGroupInfo} disabled={loading || !groupNameInput.trim()} style={{ flex: 1, padding: "7px", fontSize: "0.8rem", border: "none", borderRadius: 6, background: "var(--text-primary)", color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                      <Save style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />저장
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{group.name}</p>
                  {group.description && <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>{group.description}</p>}
                </div>
              )}
            </div>
          </div>

          {/* ── 멤버 목록 ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <span style={labelStyle}>멤버 ({group.members.length}명)</span>
            </div>
            <div>
              {group.members.map((member, idx) => {
                const isCurrentUser = member.userId === userId;
                const isMemberAdmin = member.userId === group.leaderId;
                const displayName = member.nickname || member.user.name || member.user.email?.split("@")[0] || "알 수 없음";
                const memberRole = isMemberAdmin ? "관리자" : member.role || "MEMBER";

                return (
                  <div
                    key={member.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderBottom: idx < group.members.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      position: "relative",
                    }}
                  >
                    {member.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.user.image} alt="" style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface-raised)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingMemberId === member.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="text"
                            value={nicknameInput}
                            onChange={(e) => setNicknameInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveNickname(member.id); if (e.key === "Escape") setEditingMemberId(null); }}
                            autoFocus
                            style={{ flex: 1, padding: "4px 8px", border: "1px solid var(--accent)", borderRadius: 5, fontSize: "0.8rem", outline: "none", fontFamily: "inherit", background: "var(--surface)", color: "var(--text-primary)" }}
                          />
                          <button onClick={() => saveNickname(member.id)} disabled={loading} style={{ fontSize: "0.75rem", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>저장</button>
                          <button onClick={() => setEditingMemberId(null)} style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>취소</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{displayName}</span>
                          <RoleBadge role={memberRole} />
                          {isCurrentUser && (
                            <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "#EFF6FF", color: "#3B82F6" }}>나</span>
                          )}
                          {member.nickname && (
                            <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>({member.user.name || member.user.email})</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 액션 */}
                    {editingMemberId !== member.id && (
                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        {(isLeader || isCurrentUser) && (
                          <button
                            onClick={() => { setEditingMemberId(member.id); setNicknameInput(member.nickname ?? member.user.name ?? ""); }}
                            title="닉네임 수정"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 4, color: "var(--text-tertiary)", display: "flex" }}
                          >
                            <Pencil style={{ width: 12, height: 12 }} />
                          </button>
                        )}
                        {isAdmin && !isMemberAdmin && (
                          <>
                            {/* 역할 변경 */}
                            <div style={{ position: "relative" }}>
                              <button
                                onClick={() => setRoleMenuId(roleMenuId === member.id ? null : member.id)}
                                title="역할 변경"
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 4, color: "var(--text-tertiary)", display: "flex" }}
                              >
                                <ShieldCheck style={{ width: 12, height: 12 }} />
                              </button>
                              {roleMenuId === member.id && (
                                <div style={{
                                  position: "fixed",
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 8,
                                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                                  zIndex: 100,
                                  minWidth: 110,
                                  overflow: "hidden",
                                  right: 20,
                                }}>
                                  {["그룹장", "파트장", "MEMBER"].map((r) => (
                                    <button
                                      key={r}
                                      onClick={() => setMemberRole(member, r, displayName)}
                                      style={{
                                        width: "100%",
                                        display: "block",
                                        padding: "9px 14px",
                                        textAlign: "left",
                                        background: member.role === r ? "var(--surface-raised)" : "none",
                                        border: "none",
                                        borderBottom: r !== "MEMBER" ? "1px solid var(--border-subtle)" : "none",
                                        cursor: "pointer",
                                        fontSize: "0.82rem",
                                        color: "var(--text-primary)",
                                        fontFamily: "inherit",
                                        letterSpacing: "-0.01em",
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = member.role === r ? "var(--surface-raised)" : "none")}
                                    >
                                      {r === "MEMBER" ? "일반 멤버" : r}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* 멤버 제거 */}
                            <button
                              onClick={() => removeMember(member.id, displayName)}
                              disabled={loading}
                              title="멤버 제거"
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 4, color: "var(--text-tertiary)", display: "flex" }}
                            >
                              <UserMinus style={{ width: 12, height: 12 }} />
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
          {isAdmin && (
            <div style={{ border: "1px solid #FEE2E2", borderRadius: 10 }}>
              <div style={{ padding: "8px 14px", background: "#FFF5F5", borderBottom: "1px solid #FEE2E2", borderRadius: "10px 10px 0 0" }}>
                <span style={{ ...labelStyle, color: "#F87171" }}>위험 구역</span>
              </div>
              <div style={{ padding: "10px 14px" }}>
                <button
                  onClick={deleteGroup}
                  disabled={loading}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: "0.8rem", color: "#DC2626", background: "none", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                  그룹 삭제
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 드롭다운 닫기용 오버레이 */}
        {roleMenuId && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setRoleMenuId(null)}
          />
        )}
      </div>
    </div>
  );
}
