"use client";

import { useState, useEffect } from "react";
import { X, Trash2, User, Users } from "lucide-react";

type UserRecord = {
  id: string;
  name: string | null;
  email: string | null;
  employeeId: string | null;
  createdAt: string;
  groupMembers: Array<{
    role: string;
    group: { id: string; name: string };
  }>;
};

type Props = {
  currentUserId: string;
  onClose: () => void;
};

export default function AdminModal({ currentUserId, onClose }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

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
    setDeletingId(userId);
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
      setDeletingId(null);
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
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 520,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          border: "1px solid var(--border)",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users style={{ width: 16, height: 16, color: "var(--accent)" }} />
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              사용자 관리
            </span>
            {!loading && (
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 10,
                  background: "var(--surface-raised)",
                  color: "var(--text-tertiary)",
                }}
              >
                {users.length}명
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              color: "var(--text-tertiary)",
              display: "flex",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* 오류 */}
        {error && (
          <div style={{ padding: "10px 20px", background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
            <p style={{ fontSize: "0.78rem", color: "#DC2626" }}>{error}</p>
          </div>
        )}

        {/* 사용자 목록 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32, color: "var(--text-tertiary)" }}>
              <p style={{ fontSize: "0.875rem" }}>불러오는 중...</p>
            </div>
          ) : users.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32, color: "var(--text-tertiary)" }}>
              <p style={{ fontSize: "0.875rem" }}>등록된 사용자가 없습니다</p>
            </div>
          ) : (
            users.map((u) => {
              const isSelf = u.id === currentUserId;
              const isGuest = u.email?.endsWith("@local.guest");
              return (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: isSelf ? "var(--accent-light)" : "var(--surface)",
                  }}
                >
                  {/* 아바타 */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: isSelf ? "var(--accent)" : "var(--surface-raised)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <User style={{ width: 14, height: 14, color: isSelf ? "white" : "var(--text-tertiary)" }} />
                  </div>

                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.name || "이름 없음"}
                      </p>
                      {isSelf && (
                        <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "var(--accent)", color: "white" }}>나</span>
                      )}
                      {isGuest && (
                        <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "var(--surface-raised)", color: "var(--text-tertiary)" }}>
                          Guest{u.employeeId ? ` #${u.employeeId}` : ""}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isGuest ? (u.employeeId ? `사번: ${u.employeeId}` : "게스트") : u.email}
                    </p>
                    {u.groupMembers.length > 0 && (
                      <p style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", marginTop: 1 }}>
                        {u.groupMembers.map((m) => `${m.group.name}(${m.role})`).join(", ")}
                      </p>
                    )}
                  </div>

                  {/* 삭제 버튼 */}
                  {!isSelf && (
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      disabled={deletingId === u.id}
                      title="계정 삭제"
                      style={{
                        background: "none",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        padding: "5px 8px",
                        borderRadius: 6,
                        color: "var(--text-tertiary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.72rem",
                        flexShrink: 0,
                        fontFamily: "inherit",
                        transition: "all 0.1s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#FEF2F2";
                        e.currentTarget.style.borderColor = "#FECACA";
                        e.currentTarget.style.color = "#DC2626";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "none";
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.color = "var(--text-tertiary)";
                      }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                      {deletingId === u.id ? "삭제 중..." : "삭제"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 푸터 안내 */}
        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
            계정 삭제 시 해당 사용자의 그룹 멤버십과 일정도 함께 삭제됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
