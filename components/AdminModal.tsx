"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Crown, Trash2, User, Users, X } from "lucide-react";

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

type GroupOption = {
  id: string;
  name: string;
};

type Props = {
  currentUserId: string;
  onClose: () => void;
};

function getRoleLabel(role: string, isGroupLeader: boolean) {
  if (isGroupLeader) return "관리자";
  if (role === "ADMIN" || role === "그룹장" || role === "리더") return "리더";
  if (role === "OBSERVER") return "옵저버";
  return "멤버";
}

export default function AdminModal({ currentUserId, onClose }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assignGroupByUser, setAssignGroupByUser] = useState<Record<string, string>>({});

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/groups");
      if (!res.ok) return;
      const data = (await res.json()) as GroupOption[];
      setGroups(data.map((group) => ({ id: group.id, name: group.name })));
    } catch {
      // Keep the modal usable even if group loading fails.
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchGroups();
  }, []);

  const handleDelete = async (userId: string, name: string | null) => {
    if (
      !confirm(
        `"${name || "사용자"}" 계정을 삭제하시겠습니까?\n그룹 멤버십과 일정도 함께 제거됩니다.`,
      )
    ) {
      return;
    }

    setActionLoading(userId + "-delete");
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((user) => user.id !== userId));
      } else {
        const data = await res.json();
        setError(data.error || "사용자 삭제에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleOperator = async (
    userId: string,
    currentValue: boolean,
    name: string | null,
  ) => {
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
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, isOperator: !currentValue } : user,
          ),
        );
      } else {
        const data = await res.json();
        setError(data.error || "권한 변경에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransferLeader = async (
    groupId: string,
    groupName: string,
    newLeaderId: string,
    newLeaderName: string | null,
  ) => {
    if (
      !confirm(
        `"${groupName}" 그룹의 관리자를 "${newLeaderName || "사용자"}"로 변경하시겠습니까?`,
      )
    ) {
      return;
    }

    setActionLoading(groupId + "-leader");
    setError("");
    try {
      const res = await fetch("/api/operator/transfer-leader", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, newLeaderId }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((user) => ({
            ...user,
            groupMembers: user.groupMembers.map((member) =>
              member.group.id === groupId
                ? { ...member, group: { ...member.group, leaderId: newLeaderId } }
                : member,
            ),
          })),
        );
      } else {
        const data = await res.json();
        setError(data.error || "관리자 변경에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleForceAssignGroup = async (user: UserRecord) => {
    const groupId = assignGroupByUser[user.id];
    if (!groupId) {
      setError("배정할 그룹을 먼저 선택해 주세요.");
      return;
    }

    setActionLoading(user.id + "-assign");
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "그룹 배정에 실패했습니다.");
        return;
      }

      const membership = await res.json();
      setUsers((prev) =>
        prev.map((item) =>
          item.id !== user.id
            ? item
            : {
                ...item,
                groupMembers: item.groupMembers.some((member) => member.id === membership.id)
                  ? item.groupMembers.map((member) =>
                      member.id === membership.id ? membership : member,
                    )
                  : [...item.groupMembers, membership],
              },
        ),
      );
      setAssignGroupByUser((prev) => ({ ...prev, [user.id]: "" }));
      setExpandedUserId(user.id);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleForceRemoveGroup = async (
    user: UserRecord,
    membership: GroupMembership,
    isGroupLeader: boolean,
  ) => {
    if (isGroupLeader) {
      setError("현재 그룹 관리자는 강제 퇴출할 수 없습니다. 먼저 관리자 변경이 필요합니다.");
      return;
    }

    if (
      !confirm(
        `"${user.name || "사용자"}"를 "${membership.group.name}" 그룹에서 강제 퇴출하시겠습니까?`,
      )
    ) {
      return;
    }

    setActionLoading(membership.id + "-remove");
    setError("");
    try {
      const res = await fetch(
        `/api/groups/${membership.group.id}/members/${membership.id}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "강제 퇴출에 실패했습니다.");
        return;
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id !== user.id
            ? item
            : {
                ...item,
                groupMembers: item.groupMembers.filter((member) => member.id !== membership.id),
              },
        ),
      );
    } catch {
      setError("네트워크 오류가 발생했습니다.");
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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 560,
          height: "90vh",
          maxHeight: 700,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          border: "1px solid var(--border)",
        }}
      >
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
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.9rem",
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              서버 인원 관리
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

        {error && (
          <div
            style={{
              padding: "10px 20px",
              background: "#FEF2F2",
              borderBottom: "1px solid #FECACA",
            }}
          >
            <p style={{ fontSize: "0.78rem", color: "#DC2626" }}>{error}</p>
          </div>
        )}

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>
                불러오는 중...
              </p>
            </div>
          ) : users.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>
                등록된 사용자가 없습니다
              </p>
            </div>
          ) : (
            users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isGuest = user.email?.endsWith("@local.guest");
              const isExpanded = expandedUserId === user.id;
              const availableGroups = groups.filter(
                (group) => !user.groupMembers.some((member) => member.group.id === group.id),
              );

              return (
                <div
                  key={user.id}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${user.isOperator ? "#DDD6FE" : "var(--border)"}`,
                    background: user.isOperator
                      ? "#F5F3FF"
                      : isSelf
                        ? "var(--accent-light)"
                        : "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, padding: "10px 12px 0" }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: user.isOperator
                          ? "#7C3AED"
                          : isSelf
                            ? "var(--accent)"
                            : "var(--surface-raised)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <User
                        style={{
                          width: 14,
                          height: 14,
                          color: user.isOperator || isSelf ? "white" : "var(--text-tertiary)",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          flexWrap: "wrap",
                          marginBottom: 2,
                        }}
                      >
                        <p
                          style={{
                            fontSize: "0.825rem",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {user.name || "이름 없음"}
                        </p>
                        {user.isOperator && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "#7C3AED",
                              color: "white",
                            }}
                          >
                            운영자
                          </span>
                        )}
                        {isSelf && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              padding: "1px 5px",
                              borderRadius: 4,
                              background: "var(--accent)",
                              color: "white",
                            }}
                          >
                            나
                          </span>
                        )}
                        {isGuest && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              padding: "1px 5px",
                              borderRadius: 4,
                              background: "var(--surface-raised)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            Guest{user.employeeId ? ` #${user.employeeId}` : ""}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-tertiary)",
                          wordBreak: "break-all",
                        }}
                      >
                        {isGuest
                          ? user.employeeId
                            ? `사번: ${user.employeeId}`
                            : "게스트"
                          : user.email}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px 10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: isExpanded ? "var(--surface-raised)" : "var(--surface)",
                        cursor: "pointer",
                        fontSize: "0.72rem",
                        color: "var(--text-secondary)",
                        fontFamily: "inherit",
                      }}
                    >
                      <ChevronDown
                        style={{
                          width: 11,
                          height: 11,
                          transform: isExpanded ? "rotate(180deg)" : "none",
                          transition: "transform 0.15s",
                        }}
                      />
                      그룹 관리
                    </button>

                    {!isSelf && (
                      <button
                        onClick={() =>
                          handleToggleOperator(user.id, user.isOperator, user.name)
                        }
                        disabled={actionLoading === user.id + "-operator"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: `1px solid ${user.isOperator ? "#DDD6FE" : "var(--border)"}`,
                          background: user.isOperator ? "#EDE9FE" : "var(--surface)",
                          cursor: "pointer",
                          color: user.isOperator ? "#7C3AED" : "var(--text-secondary)",
                          fontFamily: "inherit",
                          fontSize: "0.72rem",
                        }}
                      >
                        <Crown style={{ width: 12, height: 12 }} />
                        {user.isOperator ? "권한 회수" : "운영자 지정"}
                      </button>
                    )}

                    {!isSelf && (
                      <button
                        onClick={() => handleDelete(user.id, user.name)}
                        disabled={actionLoading === user.id + "-delete"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          cursor: "pointer",
                          color: "var(--text-tertiary)",
                          fontFamily: "inherit",
                          fontSize: "0.72rem",
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background = "#FEF2F2";
                          event.currentTarget.style.borderColor = "#FECACA";
                          event.currentTarget.style.color = "#DC2626";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background = "var(--surface)";
                          event.currentTarget.style.borderColor = "var(--border)";
                          event.currentTarget.style.color = "var(--text-tertiary)";
                        }}
                      >
                        <Trash2 style={{ width: 12, height: 12 }} />
                        삭제
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        borderTop: "1px solid var(--border-subtle)",
                        padding: "10px 12px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          padding: "10px",
                          borderRadius: 8,
                          background: "var(--surface-raised)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "var(--text-secondary)",
                          }}
                        >
                          그룹 강제 배정
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <select
                            value={assignGroupByUser[user.id] ?? ""}
                            onChange={(event) =>
                              setAssignGroupByUser((prev) => ({
                                ...prev,
                                [user.id]: event.target.value,
                              }))
                            }
                            style={{
                              flex: 1,
                              minWidth: 180,
                              padding: "8px 10px",
                              borderRadius: 7,
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                              color: "var(--text-primary)",
                              fontFamily: "inherit",
                              fontSize: "0.78rem",
                            }}
                          >
                            <option value="">그룹 선택</option>
                            {availableGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleForceAssignGroup(user)}
                            disabled={
                              actionLoading === user.id + "-assign" ||
                              availableGroups.length === 0
                            }
                            style={{
                              flexShrink: 0,
                              padding: "8px 12px",
                              borderRadius: 7,
                              border: "1px solid #BFDBFE",
                              background: "#EFF6FF",
                              color: "#1D4ED8",
                              fontFamily: "inherit",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {actionLoading === user.id + "-assign" ? "배정 중..." : "그룹에 추가"}
                          </button>
                        </div>
                        {availableGroups.length === 0 && (
                          <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                            추가로 배정할 수 있는 그룹이 없습니다.
                          </p>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <p
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "var(--text-tertiary)",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          현재 그룹 목록 및 관리
                        </p>

                        {user.groupMembers.length === 0 ? (
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 7,
                              background: "var(--surface-raised)",
                            }}
                          >
                            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                              아직 속한 그룹이 없습니다.
                            </p>
                          </div>
                        ) : (
                          user.groupMembers.map((member) => {
                            const isGroupLeader = member.group.leaderId === user.id;
                            const isRemoving = actionLoading === member.id + "-remove";
                            const isTransferring = actionLoading === member.group.id + "-leader";

                            return (
                              <div
                                key={member.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "6px 8px",
                                  borderRadius: 7,
                                  background: "var(--surface-raised)",
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p
                                    style={{
                                      fontSize: "0.78rem",
                                      fontWeight: 500,
                                      color: "var(--text-primary)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {member.group.name}
                                  </p>
                                  <p
                                    style={{
                                      fontSize: "0.7rem",
                                      color: "var(--text-tertiary)",
                                    }}
                                  >
                                    {getRoleLabel(member.role, isGroupLeader)}
                                  </p>
                                </div>

                                {!isGroupLeader ? (
                                  <>
                                    <button
                                      onClick={() =>
                                        handleTransferLeader(
                                          member.group.id,
                                          member.group.name,
                                          user.id,
                                          user.name,
                                        )
                                      }
                                      disabled={isTransferring || isRemoving}
                                      style={{
                                        flexShrink: 0,
                                        padding: "5px 10px",
                                        borderRadius: 5,
                                        border: "1px solid var(--border)",
                                        background: "var(--surface)",
                                        cursor: "pointer",
                                        fontSize: "0.72rem",
                                        fontWeight: 600,
                                        color: "var(--text-secondary)",
                                        fontFamily: "inherit",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {isTransferring ? "변경 중..." : "관리자 지정"}
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleForceRemoveGroup(user, member, isGroupLeader)
                                      }
                                      disabled={isRemoving || isTransferring}
                                      style={{
                                        flexShrink: 0,
                                        padding: "5px 10px",
                                        borderRadius: 5,
                                        border: "1px solid #FECACA",
                                        background: "#FEF2F2",
                                        cursor: "pointer",
                                        fontSize: "0.72rem",
                                        fontWeight: 600,
                                        color: "#DC2626",
                                        fontFamily: "inherit",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {isRemoving ? "퇴출 중..." : "강제 퇴출"}
                                    </button>
                                  </>
                                ) : (
                                  <span
                                    style={{
                                      flexShrink: 0,
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      padding: "2px 8px",
                                      borderRadius: 5,
                                      background: "var(--text-primary)",
                                      color: "var(--surface)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    현재 관리자
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            padding: "10px 20px",
            borderTop: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
            펼침 영역에서 운영자 권한 변경, 그룹 강제 배정, 강제 퇴출, 그룹 관리자 변경을 처리할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
