"use client";

import { useEffect, useState } from "react";
import { X, Pencil, Trash2, UserMinus, Save, ShieldCheck, UserCheck, UserX, Bell, BellOff, LogOut, Upload } from "lucide-react";
import { isLeaderRole, isObserverRole, shouldCountTowardTotals } from "@/lib/groupPermissions";
import { readEquipmentCategories, type EquipmentCategory } from "@/lib/equipmentCategories";
import EquipmentCategoriesEditor from "./EquipmentCategoriesEditor";

type Member = {
  id: string;
  userId: string;
  nickname: string | null;
  role: string;
  status: string;
  canNotify: boolean;
  joinedAt: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  trackerOptions?: string | null;
  laptopOptions?: string | null;
  equipmentCategories?: string | null;
  targetCount?: number;
  eventDisplayLimit?: number;
  calendarSyncEnabled?: boolean;
  leaderId: string;
  leader: { id: string; name: string | null; email: string | null; image: string | null };
  members: Member[];
};

type Props = {
  group: Group;
  userId: string;
  isOperator?: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

const ROLE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  관리자: { label: "관리자", bg: "var(--text-primary)", color: "var(--surface)" },
  그룹장: { label: "그룹장", bg: "var(--accent-light)", color: "var(--accent)" },
  파트장: { label: "파트장", bg: "#F0FDF4", color: "#16A34A" },
  OBSERVER: { label: "옵저버", bg: "#EFF6FF", color: "#1D4ED8" },
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

export default function GroupPanel({ group, userId, isOperator, onClose, onUpdated }: Props) {
  const isAdmin = group.leaderId === userId || !!isOperator;
  const myMember = group.members.find((m) => m.userId === userId);
  const isLeader = isAdmin || isLeaderRole(myMember?.role);
  const activeMembers = group.members.filter((m) => m.status === "ACTIVE" || m.status === undefined);
  const countedMembers = activeMembers.filter((m) => shouldCountTowardTotals(m));
  const pendingMembers = group.members.filter((m) => m.status === "PENDING");

  const [loading, setLoading] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState(group.name);
  const [groupDescInput, setGroupDescInput] = useState(group.description ?? "");
  const equipmentCategories = readEquipmentCategories(group);
  const [editingEquipment, setEditingEquipment] = useState(false);
  const [equipmentInput, setEquipmentInput] = useState<EquipmentCategory[]>(equipmentCategories);
  const [equipmentError, setEquipmentError] = useState("");
  const [eventDisplayLimitInput, setEventDisplayLimitInput] = useState(
    String(group.eventDisplayLimit ?? 3)
  );
  const [calendarSyncLoading, setCalendarSyncLoading] = useState(false);
  const [calendarSyncMessage, setCalendarSyncMessage] = useState("");
  const calendarSyncOn = group.calendarSyncEnabled !== false;
  const [calendarSyncSaving, setCalendarSyncSaving] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null);
  const [memberNotify, setMemberNotify] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(group.members.map((m) => [m.id, !!m.canNotify]))
  );

  useEffect(() => {
    setEventDisplayLimitInput(String(group.eventDisplayLimit ?? 3));
  }, [group.eventDisplayLimit]);

  const uploadCalendarNow = async () => {
    setCalendarSyncLoading(true);
    setCalendarSyncMessage("");
    try {
      const response = await fetch(`/api/groups/${group.id}/calendar-sync`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCalendarSyncMessage(data.error || "GitLab 업로드에 실패했습니다.");
        return;
      }
      setCalendarSyncMessage(`${data.fileName} 업로드 완료 (${data.count ?? 0}건)`);
    } catch {
      setCalendarSyncMessage("네트워크 오류로 GitLab 업로드에 실패했습니다.");
    } finally {
      setCalendarSyncLoading(false);
    }
  };

  // GitLab upload on/off for this group (the 30-minute auto upload and the button below).
  const toggleCalendarSync = async () => {
    setCalendarSyncSaving(true);
    setCalendarSyncMessage("");
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarSyncEnabled: !calendarSyncOn }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCalendarSyncMessage(data.error || "설정을 저장하지 못했습니다.");
        return;
      }
      await onUpdated();
    } catch {
      setCalendarSyncMessage("네트워크 오류로 설정을 저장하지 못했습니다.");
    } finally {
      setCalendarSyncSaving(false);
    }
  };

  const saveGroupInfo = async () => {
    if (!groupNameInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupNameInput.trim(),
          description: groupDescInput.trim(),
        }),
      });
      if (res.ok) {
        await onUpdated();
        setEditingGroupName(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const startEditingEquipment = () => {
    setEquipmentInput(readEquipmentCategories(group));
    setEquipmentError("");
    setEditingEquipment(true);
  };

  const saveEquipment = async () => {
    const names = equipmentInput.map((category) => category.name.trim());
    if (names.some((name) => !name)) {
      setEquipmentError("분류 이름을 입력해 주세요.");
      return;
    }
    const duplicate = names.find((name, index) => names.indexOf(name) !== index);
    if (duplicate) {
      setEquipmentError(`'${duplicate}' 분류가 두 개예요. 이름을 바꿔 주세요.`);
      return;
    }
    setLoading(true);
    setEquipmentError("");
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentCategories: equipmentInput.map((category) => {
            const previous = readEquipmentCategories(group).find((entry) => entry.id === category.id);
            const name = category.name.trim();
            return { ...category, name, aliases: category.quantity !== undefined && previous && previous.name !== name ? [...(category.aliases ?? []), previous.name] : category.aliases };
          }),
          targetCount: 0,
        }),
      });
      if (res.ok) {
        await onUpdated();
        setEditingEquipment(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setEquipmentError(data.error || "장비 설정을 저장하지 못했어요.");
      }
    } catch {
      setEquipmentError("네트워크 오류로 저장하지 못했어요.");
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

  const saveEventDisplayLimit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDisplayLimit: Number(eventDisplayLimitInput) || 3,
        }),
      });
      if (res.ok) {
        await onUpdated();
      }
    } finally {
      setLoading(false);
    }
  };

  const setMemberRole = async (member: Member, role: string, displayName: string) => {
    const roleLabel = role === "그룹장" ? "그룹장" : role === "파트장" ? "파트장" : role === "OBSERVER" ? "옵저버" : "일반 멤버";
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

  const approveMember = async (memberId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (res.ok) await onUpdated();
    } finally {
      setLoading(false);
    }
  };

  const rejectMember = async (memberId: string, memberName: string) => {
    if (!confirm(`"${memberName}"의 가입을 거절하시겠습니까?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      if (res.ok) await onUpdated();
    } finally {
      setLoading(false);
    }
  };

  const toggleNotifyPermission = async (member: Member) => {
    const current = memberNotify[member.id] ?? false;
    const next = !current;
    setMemberNotify((prev) => ({ ...prev, [member.id]: next }));
    try {
      const res = await fetch("/api/admin/notify-permission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, canNotify: next }),
      });
      if (res.ok) {
        await onUpdated();
      } else {
        setMemberNotify((prev) => ({ ...prev, [member.id]: current }));
      }
    } catch {
      setMemberNotify((prev) => ({ ...prev, [member.id]: current }));
    }
  };

  const leaveGroup = async () => {
    if (!myMember) return;
    if (!confirm(`"${group.name}" 그룹에서 나가시겠습니까?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members/${myMember.id}`, { method: "DELETE" });
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
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-slide-up"
        style={{
          background: "var(--surface)",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
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

          {isLeader && (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <span style={labelStyle}>GitLab 캘린더 동기화</span>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>GitLab 업로드</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                      {calendarSyncOn ? "30분마다 자동 업로드하고, 지금 업로드도 할 수 있어요." : "꺼져 있어요. 자동 업로드와 지금 업로드를 하지 않아요."}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={calendarSyncOn}
                    aria-label="GitLab 업로드"
                    onClick={() => void toggleCalendarSync()}
                    disabled={!isAdmin || calendarSyncSaving}
                    title={isAdmin ? undefined : "그룹 관리자만 바꿀 수 있어요"}
                    style={{ position: "relative", flexShrink: 0, width: 40, height: 24, padding: 0, border: "none", borderRadius: 999, background: calendarSyncOn ? "var(--accent)" : "var(--border)", cursor: isAdmin ? "pointer" : "not-allowed", opacity: !isAdmin || calendarSyncSaving ? 0.6 : 1, transition: "background 0.15s" }}
                  >
                    <span style={{ position: "absolute", top: 3, left: calendarSyncOn ? 19 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transition: "left 0.15s" }} />
                  </button>
                </div>
                {calendarSyncOn && (
                <>
                <p style={{ margin: "0 0 10px", fontSize: "0.75rem", color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                  이 그룹의 근태·출장 일정을 “{group.name} calendar.json”으로 즉시 업로드합니다.
                </p>
                <button
                  type="button"
                  onClick={() => void uploadCalendarNow()}
                  disabled={calendarSyncLoading}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "9px 12px", border: "none", borderRadius: 7, background: "var(--accent)", color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "0.78rem", opacity: calendarSyncLoading ? 0.6 : 1 }}
                >
                  <Upload style={{ width: 14, height: 14 }} />
                  {calendarSyncLoading ? "업로드 중..." : "지금 업로드"}
                </button>
                </>
                )}
                {calendarSyncMessage && (
                  <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: calendarSyncMessage.includes("완료") ? "#15803D" : "#DC2626" }}>
                    {calendarSyncMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── 그룹 정보 ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <span style={labelStyle}>그룹 정보</span>
              {isAdmin && !editingGroupName && (
                <button
                  onClick={() => {
                    setGroupNameInput(group.name);
                    setGroupDescInput(group.description ?? "");
                    setEditingGroupName(true);
                  }}
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

          {/* ── 장비 ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <span style={labelStyle}>장비</span>
              {isAdmin && !editingEquipment && (
                <button
                  onClick={startEditingEquipment}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--accent)", fontWeight: 500, fontFamily: "inherit" }}
                >
                  수정
                </button>
              )}
            </div>
            <div style={{ padding: "12px 14px" }}>
              {editingEquipment ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <EquipmentCategoriesEditor value={equipmentInput} onChange={setEquipmentInput} />
                  {equipmentError && <p style={{ margin: 0, fontSize: "0.74rem", color: "#DC2626" }}>{equipmentError}</p>}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditingEquipment(false)} style={{ flex: 1, padding: "7px", fontSize: "0.8rem", border: "1px solid var(--border)", borderRadius: 6, background: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text-secondary)" }}>취소</button>
                    <button onClick={saveEquipment} disabled={loading} style={{ flex: 1, padding: "7px", fontSize: "0.8rem", border: "none", borderRadius: 6, background: "var(--text-primary)", color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                      <Save style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />저장
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {equipmentCategories.length === 0 && (
                    <p style={{ fontSize: "0.76rem", color: "var(--text-tertiary)" }}>장비 분류가 없어요.</p>
                  )}
                  {equipmentCategories.map((category) => (
                    <div key={category.id}>
                      <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>{category.name} · {category.quantity ?? category.items.length}개</p>
                      <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: 2, whiteSpace: "pre-wrap" }}>
                        {category.quantity !== undefined ? "수량으로 관리" : category.items.length > 0 ? category.items.join(", ") : "등록된 장비 없음"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 가입 요청 (리더/관리자만) ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <span style={labelStyle}>일정 표시줄</span>
            </div>
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                월간 캘린더에서 하루에 보여줄 일정 표시줄 개수를 설정합니다.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={eventDisplayLimitInput}
                  onChange={(e) => setEventDisplayLimitInput(e.target.value)}
                  disabled={!isAdmin || loading}
                  style={{
                    width: 84,
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    fontSize: "0.85rem",
                    outline: "none",
                    fontFamily: "inherit",
                    color: "#6B7280",
                    background: isAdmin ? "var(--surface)" : "var(--surface-raised)",
                  }}
                />
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={saveEventDisplayLimit}
                    disabled={loading}
                    style={{
                      padding: "8px 12px",
                      fontSize: "0.78rem",
                      border: "none",
                      borderRadius: 7,
                      background: "var(--text-primary)",
                      color: "#fff",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: 600,
                    }}
                  >
                    확인
                  </button>
                ) : (
                  <span style={{ fontSize: "0.76rem", color: "var(--text-tertiary)" }}>
                    {group.eventDisplayLimit ?? 3}개
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                기본값은 3개이며 1개부터 10개까지 지정할 수 있습니다.
              </p>
            </div>
          </div>

          {isLeader && pendingMembers.length > 0 && (
            <div style={{ border: "1px solid #FDE68A", borderRadius: 10 }}>
              <div style={{ padding: "8px 14px", background: "#FFFBEB", borderBottom: "1px solid #FDE68A", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...labelStyle, color: "#D97706" }}>가입 요청</span>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "#FEF3C7", color: "#D97706" }}>{pendingMembers.length}명</span>
              </div>
              <div>
                {pendingMembers.map((member, idx) => {
                  const displayName = member.nickname || member.user.name || member.user.email?.split("@")[0] || "알 수 없음";
                  return (
                    <div
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        borderBottom: idx < pendingMembers.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#FEF3C7", border: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.75rem", fontWeight: 600, color: "#D97706" }}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.user.email}</p>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => approveMember(member.id)}
                          disabled={loading}
                          title="수락"
                          style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 5, border: "none", background: "#D1FAE5", color: "#065F46", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, fontFamily: "inherit" }}
                        >
                          <UserCheck style={{ width: 12, height: 12 }} />수락
                        </button>
                        <button
                          onClick={() => rejectMember(member.id, displayName)}
                          disabled={loading}
                          title="거절"
                          style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 5, border: "none", background: "#FEE2E2", color: "#991B1B", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, fontFamily: "inherit" }}
                        >
                          <UserX style={{ width: 12, height: 12 }} />거절
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 멤버 목록 ── */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <span style={labelStyle}>멤버 ({countedMembers.length}명)</span>
            </div>
            <div>
              {activeMembers.map((member, idx) => {
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
                      borderBottom: idx < activeMembers.length - 1 ? "1px solid var(--border-subtle)" : "none",
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
                                  position: "absolute",
                                  top: "calc(100% + 6px)",
                                  right: 0,
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 8,
                                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                                  zIndex: 100,
                                  minWidth: 110,
                                  overflow: "hidden",
                                }}>
                                  {["그룹장", "파트장", "MEMBER", "OBSERVER"].map((r) => (
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
                                        borderBottom: r !== "OBSERVER" ? "1px solid var(--border-subtle)" : "none",
                                        cursor: "pointer",
                                        fontSize: "0.82rem",
                                        color: "var(--text-primary)",
                                        fontFamily: "inherit",
                                        letterSpacing: "-0.01em",
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = member.role === r ? "var(--surface-raised)" : "none")}
                                    >
                                      {r === "MEMBER" ? "일반 멤버" : r === "OBSERVER" ? "옵저버" : r}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* 알림 발송 권한 토글 */}
                            {!isObserverRole(member.role) && (
                              <button
                                onClick={() => toggleNotifyPermission(member)}
                                title={memberNotify[member.id] ? "알림 발송 권한 회수" : "알림 발송 권한 부여"}
                                style={{
                                  background: memberNotify[member.id] ? "#FFFBEB" : "none",
                                  border: memberNotify[member.id] ? "1px solid #FDE68A" : "none",
                                  cursor: "pointer", padding: 5, borderRadius: 4,
                                  color: memberNotify[member.id] ? "#D97706" : "var(--text-tertiary)",
                                  display: "flex",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {memberNotify[member.id]
                                  ? <Bell style={{ width: 12, height: 12 }} />
                                  : <BellOff style={{ width: 12, height: 12 }} />}
                              </button>
                            )}

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
          {(isAdmin || (myMember && group.leaderId !== userId)) && (
            <div style={{ border: "1px solid #FEE2E2", borderRadius: 10 }}>
              <div style={{ padding: "8px 14px", background: "#FFF5F5", borderBottom: "1px solid #FEE2E2", borderRadius: "10px 10px 0 0" }}>
                <span style={{ ...labelStyle, color: "#F87171" }}>위험 구역</span>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                {isAdmin && (
                  <button
                    onClick={deleteGroup}
                    disabled={loading}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: "0.8rem", color: "#DC2626", background: "none", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
                  >
                    <Trash2 style={{ width: 13, height: 13 }} />
                    그룹 삭제
                  </button>
                )}
                {myMember && group.leaderId !== userId && (
                  <button
                    onClick={leaveGroup}
                    disabled={loading}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: "0.8rem", color: "#92400E", background: "none", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
                  >
                    <LogOut style={{ width: 13, height: 13 }} />
                    그룹 나가기
                  </button>
                )}
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
