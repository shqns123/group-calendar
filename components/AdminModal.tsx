"use client";

import { useState, useEffect } from "react";
import { X, Trash2, User, Users, Crown, CrownOff, ChevronDown } from "lucide-react";

type GroupMembership = {
  id: string;
  role: string;
  group: { id: string; name: string; leaderId: string };
};

type UserRecord = {
  id: string;
  name: string | null;
  email: string | null;
  employeeId: string | null;
  isOperator: boolean;
  createdAt: string;
  groupMembers: GroupMembership[];
};

type Props = {
  currentUserId: string;
  onClose: () => void;
};

export default function AdminModal({ currentUserId, onClose }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (userId: string, name: string | null) => {
    if (!confirm(`"${name || "사용자"}"의 계정을 삭제하시겠습니까?\n그룹 멤버십과 일정도 함께 삭제됩니다.`)) return;
    setActionLoading(userId + "-delete");
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        const data = await res.json();
        setError(data.error || "삭제에 실패했습니다");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleOperator = async (userId: string, currentValue: boolean, name: string | null) => {
    const label = currentValue ? "운영자 권한을 회수" : "운영자로 지정";
    if (!confirm(`"${name || "사용자"}"를 ${label}하시겠습니까?`)) return;
    setActionLoading(userId + "-operator");
    setError("");
    try {
      const res = await fetch("/api/operator/set-operator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isOperator: !currentValue }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isOperator: !currentValue } : u));
      } else {
        const data = await res.json();
        setError(data.error || "권한 변경에 실패했습니다");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransferLeader = async (groupId: string, groupName: string, newLeaderId: string, newLeaderName: string | null) => {
    if (!confirm(`"${groupName}" 그룹의 관리자를 "${newLeaderName || "사용자"}"로 변경하시겠습니까?`)) return;
    setActionLoading(groupId + "-leader");
    setError("");
    try {
      const res = await fetch("/api/operator/transfer-leader", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, newLeaderId }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => ({
          ...u,
          groupMembers: u.groupMembers.map((m) =>
            m.group.id === groupId ? { ...m, group: { ...m.group, leaderId: newLeaderId } } : m
          ),
        })));
      } else {
        const data = await res.json();
        setError(data.error || "관리자 변경에 실패했습니다");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--surface)", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid var(--border)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users style={{ width: 16, height: 16, color: "var(--accent)" }} />
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>사용자 관리</span>
            {!loading && <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "1px 6px", borderRadius: 10, background: "var(--surface-raised)", color: "var(--text-tertiary)" }}>{users.length}명</span>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "var(--text-tertiary)", display: "flex" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {error && <div style={{ padding: "10px 20px", background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}><p style={{ fontSize: "0.78rem", color: "#DC2626" }}>{error}</p></div>}

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>불러오는 중...</p></div>
          ) : users.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>등록된 사용자가 없습니다</p></div>
          ) : users.map((u) => {
            const isSelf = u.id === currentUserId;
            const isGuest = u.email?.endsWith("@local.guest");
            const isExpanded = expandedUserId === u.id;
            return (
              <div key={u.id} style={{ borderRadius: 10, border: `1px solid ${u.isOperator ? "#DDD6FE" : "var(--border)"}`, background: u.isOperator ? "#F5F3FF" : isSelf ? "var(--accent-light)" : "var(--surface)", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: u.isOperator ? "#7C3AED" : isSelf ? "var(--accent)" : "var(--surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <User style={{ width: 14, height: 14, color: u.isOperator || isSelf ? "white" : "var(--text-tertiary)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                      <p style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || "이름 없음"}</p>
                      {u.isOperator && <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#7C3AED", color: "white" }}>운영자</span>}
                      {isSelf && <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "var(--accent)", color: "white" }}>나</span>}
                      {isGuest && <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "var(--surface-raised)", color: "var(--text-tertiary)" }}>Guest{u.employeeId ? ` #${u.employeeId}` : ""}</span>}
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isGuest ? (u.employeeId ? `사번: ${u.employeeId}` : "게스트") : u.email}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {u.groupMembers.length > 0 && (
                      <button onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                        style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: isExpanded ? "var(--surface-raised)" : "none", cursor: "pointer", fontSize: "0.72rem", color: "var(--text-tertiary)", fontFamily: "inherit" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = isExpanded ? "var(--surface-raised)" : "none")}
                      >
                        <ChevronDown style={{ width: 11, height: 11, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                        그룹 {u.groupMembers.length}
                      </button>
                    )}
                    {!isSelf && (
                      <button onClick={() => handleToggleOperator(u.id, u.isOperator, u.name)}
                        disabled={actionLoading === u.id + "-operator"}
                        title={u.isOperator ? "운영자 권한 회수" : "운영자로 지정"}
                        style={{ padding: "5px 6px", borderRadius: 6, border: `1px solid ${u.isOperator ? "#DDD6FE" : "var(--border)"}`, background: u.isOperator ? "#EDE9FE" : "none", cursor: "pointer", color: u.isOperator ? "#7C3AED" : "var(--text-tertiary)", display: "flex" }}
                        onMouseEnter={(e) => { if (!u.isOperator) { e.currentTarget.style.background = "var(--surface-raised)"; } }}
                        onMouseLeave={(e) => { if (!u.isOperator) { e.currentTarget.style.background = "none"; } }}
                      >
                        {u.isOperator ? <CrownOff style={{ width: 13, height: 13 }} /> : <Crown style={{ width: 13, height: 13 }} />}
                      </button>
                    )}
                    {!isSelf && (
                      <button onClick={() => handleDelete(u.id, u.name)}
                        disabled={actionLoading === u.id + "-delete"}
                        title="계정 삭제"
                        style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "flex" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; e.currentTarget.style.color = "#DC2626"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}
                      >
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>그룹 멤버십 · 관리자 변경</p>
                    {u.groupMembers.map((m) => {
                      const isGroupLeader = m.group.leaderId === u.id;
                      return (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, background: "var(--surface-raised)" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)" }}>{m.group.name}</p>
                            <p style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{isGroupLeader ? "관리자" : m.role === "MEMBER" ? "멤버" : m.role}</p>
                          </div>
                          {!isGroupLeader ? (
                            <button onClick={() => handleTransferLeader(m.group.id, m.group.name, u.id, u.name)}
                              disabled={actionLoading === m.group.id + "-leader"}
                              style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)", fontFamily: "inherit", whiteSpace: "nowrap" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#F5F3FF"; e.currentTarget.style.borderColor = "#DDD6FE"; e.currentTarget.style.color = "#7C3AED"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                            >
                              {actionLoading === m.group.id + "-leader" ? "변경 중..." : "관리자로 지정"}
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "var(--text-primary)", color: "var(--surface)" }}>현재 관리자</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
            👑 버튼으로 운영자 지정 · 회수 / 그룹 버튼으로 그룹 관리자 변경이 가능합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
