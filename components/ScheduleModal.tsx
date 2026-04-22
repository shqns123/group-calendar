"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Bell, ToggleLeft, ToggleRight, Pencil, Send, Check } from "lucide-react";

type Schedule = {
  id: string;
  groupId: string;
  message: string;
  dayOfWeek: string;
  timeHour: number;
  timeMin: number;
  active: boolean;
};

type EditState = {
  id: string;
  message: string;
  days: number[];
  hour: number;
  min: number;
};

type Props = {
  groupId: string;
  groupName: string;
  onClose: () => void;
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function ScheduleModal({ groupId, groupName, onClose }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);

  // 새 스케줄
  const [message, setMessage] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([3]);
  const [timeHour, setTimeHour] = useState(9);
  const [timeMin, setTimeMin] = useState(0);
  const [adding, setAdding] = useState(false);

  // 인라인 수정
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  // 즉시 공지 발송
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);

  const fetchSchedules = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/schedules?groupId=${groupId}`);
    if (res.ok) setSchedules(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchSchedules(); }, [groupId]);

  const handleAdd = async () => {
    if (!message.trim() || selectedDays.length === 0) return;
    setAdding(true);
    await fetch("/api/admin/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId,
        message: message.trim(),
        dayOfWeek: selectedDays.sort((a, b) => a - b).join(","),
        timeHour,
        timeMin,
      }),
    });
    setAdding(false);
    setMessage("");
    fetchSchedules();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await fetch("/api/admin/schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/admin/schedules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchSchedules();
  };

  const startEdit = (s: Schedule) => {
    setEditing({
      id: s.id,
      message: s.message,
      days: s.dayOfWeek.split(",").map(Number),
      hour: s.timeHour,
      min: s.timeMin,
    });
  };

  const handleEditSave = async () => {
    if (!editing || !editing.message.trim() || editing.days.length === 0) return;
    setSaving(true);
    await fetch("/api/admin/schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        message: editing.message.trim(),
        dayOfWeek: editing.days.sort((a, b) => a - b).join(","),
        timeHour: editing.hour,
        timeMin: editing.min,
      }),
    });
    setSaving(false);
    setEditing(null);
    fetchSchedules();
  };

  const handleInstantNotify = async () => {
    if (!notifyMessage.trim()) return;
    setNotifySending(true);
    setNotifyResult(null);
    const res = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, message: notifyMessage.trim() }),
    });
    const data = await res.json();
    setNotifyResult(res.ok ? `발송 완료 (${data.sent ?? 0}명)` : (data.error ?? "발송 실패"));
    setNotifySending(false);
    if (res.ok) setNotifyMessage("");
    setTimeout(() => setNotifyResult(null), 3000);
  };

  const toggleDay = (d: number) =>
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const toggleEditDay = (d: number) => {
    if (!editing) return;
    setEditing((prev) => prev ? {
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter((x) => x !== d) : [...prev.days, d],
    } : prev);
  };

  const formatTime = (h: number, m: number) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  const formatDays = (dayStr: string) =>
    dayStr.split(",").map((d) => DAY_LABELS[Number(d)]).join(", ");

  const selectStyle = {
    padding: "6px 10px", borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface)", color: "var(--text-primary)",
    fontSize: "0.875rem", fontFamily: "inherit", cursor: "pointer",
  };

  const dayButtonStyle = (active: boolean) => ({
    width: 32, height: 32, borderRadius: "50%",
    border: "1px solid",
    borderColor: active ? "var(--text-primary)" : "var(--border)",
    background: active ? "var(--text-primary)" : "transparent",
    color: active ? "var(--surface)" : "var(--text-secondary)",
    fontSize: "0.75rem", fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.15s ease",
  });

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="modal-scale-in"
        style={{
          background: "var(--surface)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 500,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>알림 스케줄 관리</p>
            <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 2 }}>{groupName}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-tertiary)", display: "flex" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* 즉시 공지 발송 */}
          <div style={{ background: "var(--accent-light)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--accent-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Send style={{ width: 14, height: 14, color: "var(--accent)" }} />
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--accent)" }}>즉시 공지 발송</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleInstantNotify(); }}
                placeholder="전체 멤버에게 바로 발송할 메시지"
                maxLength={200}
                style={{
                  flex: 1, padding: "8px 12px",
                  border: "1px solid var(--accent-muted)", borderRadius: 8,
                  background: "var(--surface)", color: "var(--text-primary)",
                  fontSize: "0.875rem", fontFamily: "inherit", outline: "none",
                }}
              />
              <button
                onClick={handleInstantNotify}
                disabled={notifySending || !notifyMessage.trim()}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "8px 14px", borderRadius: 8, border: "none",
                  background: "var(--accent)", color: "#fff",
                  fontSize: "0.825rem", fontWeight: 600,
                  cursor: (notifySending || !notifyMessage.trim()) ? "not-allowed" : "pointer",
                  opacity: (notifySending || !notifyMessage.trim()) ? 0.5 : 1,
                  fontFamily: "inherit", flexShrink: 0,
                }}
              >
                <Send style={{ width: 13, height: 13 }} />
                {notifySending ? "발송 중..." : "발송"}
              </button>
            </div>
            {notifyResult && (
              <p style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600 }}>{notifyResult}</p>
            )}
          </div>

          {/* 새 스케줄 추가 */}
          <div style={{ background: "var(--surface-raised)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>새 스케줄 추가</p>

            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginBottom: 6 }}>요일</p>
              <div style={{ display: "flex", gap: 5 }}>
                {DAY_LABELS.map((label, idx) => (
                  <button key={idx} onClick={() => toggleDay(idx)} style={dayButtonStyle(selectedDays.includes(idx))}>{label}</button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginBottom: 6 }}>시간</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select value={timeHour} onChange={(e) => setTimeHour(Number(e.target.value))} style={selectStyle}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}시</option>
                  ))}
                </select>
                <select value={timeMin} onChange={(e) => setTimeMin(Number(e.target.value))} style={selectStyle}>
                  {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}분</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginBottom: 6 }}>메시지</p>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="알림 메시지를 입력하세요"
                maxLength={100}
                style={{
                  width: "100%", padding: "8px 12px",
                  border: "1px solid var(--border)", borderRadius: 8,
                  background: "var(--surface)", color: "var(--text-primary)",
                  fontSize: "0.875rem", fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={adding || selectedDays.length === 0 || !message.trim()}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 16px", borderRadius: 8, border: "none",
                background: "var(--text-primary)", color: "var(--surface)",
                fontSize: "0.825rem", fontWeight: 600,
                cursor: adding ? "not-allowed" : "pointer",
                opacity: (adding || selectedDays.length === 0 || !message.trim()) ? 0.5 : 1,
                fontFamily: "inherit", transition: "opacity 0.15s ease",
              }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              {adding ? "추가 중..." : "스케줄 추가"}
            </button>
          </div>

          {/* 등록된 스케줄 목록 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
              등록된 스케줄 {schedules.length > 0 ? `(${schedules.length})` : ""}
            </p>

            {loading && <p style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>불러오는 중...</p>}

            {!loading && schedules.length === 0 && (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-tertiary)" }}>
                <Bell style={{ width: 28, height: 28, opacity: 0.3, margin: "0 auto 8px" }} />
                <p style={{ fontSize: "0.825rem" }}>등록된 스케줄이 없습니다</p>
              </div>
            )}

            {schedules.map((s) => {
              const isEditing = editing?.id === s.id;

              if (isEditing && editing) {
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: "14px",
                      border: "1.5px solid var(--accent)",
                      borderRadius: 10,
                      background: "var(--surface)",
                      display: "flex", flexDirection: "column", gap: 10,
                    }}
                  >
                    <div>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginBottom: 5 }}>요일</p>
                      <div style={{ display: "flex", gap: 5 }}>
                        {DAY_LABELS.map((label, idx) => (
                          <button key={idx} onClick={() => toggleEditDay(idx)} style={dayButtonStyle(editing.days.includes(idx))}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginBottom: 5 }}>시간</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <select value={editing.hour} onChange={(e) => setEditing({ ...editing, hour: Number(e.target.value) })} style={selectStyle}>
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{String(i).padStart(2, "0")}시</option>
                          ))}
                        </select>
                        <select value={editing.min} onChange={(e) => setEditing({ ...editing, min: Number(e.target.value) })} style={selectStyle}>
                          {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                            <option key={m} value={m}>{String(m).padStart(2, "0")}분</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginBottom: 5 }}>메시지</p>
                      <input
                        type="text"
                        value={editing.message}
                        onChange={(e) => setEditing({ ...editing, message: e.target.value })}
                        maxLength={100}
                        style={{
                          width: "100%", padding: "8px 12px",
                          border: "1px solid var(--border)", borderRadius: 8,
                          background: "var(--surface)", color: "var(--text-primary)",
                          fontSize: "0.875rem", fontFamily: "inherit",
                          outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => setEditing(null)}
                        style={{
                          padding: "7px 14px", borderRadius: 7,
                          border: "1px solid var(--border)", background: "none",
                          color: "var(--text-secondary)", fontSize: "0.8rem",
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleEditSave}
                        disabled={saving || !editing.message.trim() || editing.days.length === 0}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "7px 14px", borderRadius: 7, border: "none",
                          background: "var(--accent)", color: "#fff",
                          fontSize: "0.8rem", fontWeight: 600,
                          cursor: saving ? "not-allowed" : "pointer",
                          opacity: (saving || !editing.message.trim() || editing.days.length === 0) ? 0.5 : 1,
                          fontFamily: "inherit",
                        }}
                      >
                        <Check style={{ width: 13, height: 13 }} />
                        {saving ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px",
                    border: "1px solid var(--border)", borderRadius: 10,
                    background: s.active ? "var(--surface)" : "var(--surface-raised)",
                    opacity: s.active ? 1 : 0.6,
                    transition: "all 0.15s ease",
                  }}
                >
                  <Bell style={{ width: 15, height: 15, color: s.active ? "var(--accent)" : "var(--text-tertiary)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.message}
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                      매주 {formatDays(s.dayOfWeek)} · {formatTime(s.timeHour, s.timeMin)}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    <button
                      onClick={() => startEdit(s)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-tertiary)", display: "flex" }}
                      title="수정"
                    >
                      <Pencil style={{ width: 13, height: 13 }} />
                    </button>
                    <button
                      onClick={() => handleToggle(s.id, s.active)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: s.active ? "var(--accent)" : "var(--text-tertiary)", display: "flex" }}
                      title={s.active ? "비활성화" : "활성화"}
                    >
                      {s.active
                        ? <ToggleRight style={{ width: 22, height: 22 }} />
                        : <ToggleLeft style={{ width: 22, height: 22 }} />}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-tertiary)", display: "flex" }}
                      title="삭제"
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
