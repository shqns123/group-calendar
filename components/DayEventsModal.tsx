"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Clock, User, Plus, X } from "lucide-react";

type CalEvent = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string;
  isPrivate: boolean;
  overtimeAvailable: boolean;
  isOvertimeOnly: boolean;
  creatorId: string;
  groupId: string | null;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
};

type Group = {
  id: string;
  name: string;
  leaderId: string;
  members: Array<{
    id: string;
    userId: string;
    nickname: string | null;
    role: string;
    user: { id: string; name: string | null; email: string | null; image: string | null };
  }>;
};

type Props = {
  date: Date;
  events: CalEvent[];
  userId: string;
  group: Group | null;
  isLeader: boolean;
  onEventClick: (event: CalEvent) => void;
  onAddClick: () => void;
  onClose: () => void;
  onRefresh: () => void;
};

export default function DayEventsModal({ date, events, userId, group, isLeader, onEventClick, onAddClick, onClose, onRefresh }: Props) {
  const [overtimeLoading, setOvertimeLoading] = useState(false);

  const getMemberName = (event: CalEvent) => {
    if (!group) return event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
    const member = group.members.find((m) => m.userId === event.creatorId);
    return member?.nickname || event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
  };

  // 현재 유저의 이 날 isOvertimeOnly 이벤트
  const myOvertimeEvent = events.find(
    (e) => e.isOvertimeOnly && e.creatorId === userId &&
      format(new Date(e.startDate), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
  );
  const overtimeOn = !!myOvertimeEvent;

  const handleOvertimeToggle = async () => {
    if (overtimeLoading) return;
    setOvertimeLoading(true);
    try {
      if (overtimeOn && myOvertimeEvent) {
        await fetch(`/api/events/${myOvertimeEvent.id}`, { method: "DELETE" });
      } else {
        const dateStr = format(date, "yyyy-MM-dd");
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "특근 가능",
            description: null,
            startDate: `${dateStr}T00:00:00`,
            endDate: `${dateStr}T00:00:00`,
            allDay: true,
            color: "#F59E0B",
            isPrivate: false,
            overtimeAvailable: true,
            isOvertimeOnly: true,
            groupId: group?.id ?? null,
          }),
        });
      }
      onRefresh();
    } finally {
      setOvertimeLoading(false);
    }
  };

  const visibleEvents = events.filter(e => !e.isOvertimeOnly || isLeader || e.creatorId === userId);
  const sorted = [...visibleEvents].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

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
          maxWidth: 460,
          maxHeight: "75vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {format(date, "M월 d일 (E)", { locale: ko })}
            </p>
            <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 1 }}>
              {sorted.length === 0 ? "일정 없음" : `${sorted.length}개 일정`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={onAddClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 11px",
                borderRadius: 6,
                border: "none",
                background: "var(--text-primary)",
                color: "var(--surface)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Plus style={{ width: 12, height: 12 }} />
              추가
            </button>
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
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>

        {/* 특근 가능 토글 (그룹 있을 때만) */}
        {group && (
          <div
            style={{
              padding: "10px 18px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
              background: overtimeOn ? "#FFFBEB" : "transparent",
            }}
          >
            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: overtimeOn ? "#92400E" : "var(--text-secondary)" }}>
              특근 가능
            </span>
            <button
              onClick={handleOvertimeToggle}
              disabled={overtimeLoading}
              style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                border: "none",
                background: overtimeOn ? "#F59E0B" : "var(--border)",
                cursor: overtimeLoading ? "not-allowed" : "pointer",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
                opacity: overtimeLoading ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: overtimeOn ? 21 : 3,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "white",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>
        )}

        {/* 일정 목록 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {sorted.filter(e => !e.isOvertimeOnly).length === 0 && sorted.some(e => e.isOvertimeOnly) && (
            <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", padding: "4px 2px" }}>특근 가능 표시만 있습니다</p>
          )}
          {sorted.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 120,
                gap: 10,
                color: "var(--text-tertiary)",
              }}
            >
              <p style={{ fontSize: "0.875rem" }}>일정이 없습니다</p>
              <button
                onClick={onAddClick}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  color: "var(--accent)",
                  fontFamily: "inherit",
                  fontWeight: 500,
                }}
              >
                새 일정 추가
              </button>
            </div>
          ) : (
            sorted.map((event) => {
              const isOwn = event.creatorId === userId;
              const isHidden = event.isPrivate && !isOwn && !isLeader;
              if (event.isOvertimeOnly) {
                return (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      border: "1px solid #FDE68A",
                      borderRadius: 8,
                      background: "#FFFBEB",
                    }}
                  >
                    <div style={{ width: 3, borderRadius: 3, flexShrink: 0, backgroundColor: "#F59E0B" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "#92400E" }}>특근 가능</p>
                      {event.groupId && (
                        <p style={{ fontSize: "0.68rem", color: "#B45309", marginTop: 1 }}>{getMemberName(event)}</p>
                      )}
                    </div>
                  </div>
                );
              }
              const start = new Date(event.startDate);
              const end = new Date(event.endDate);
              const memberName = getMemberName(event);

              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: 10,
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    transition: "background 0.1s",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
                >
                  <div style={{ width: 3, borderRadius: 3, flexShrink: 0, backgroundColor: event.color }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p
                        style={{
                          fontSize: "0.825rem",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {isHidden ? "비공개 일정" : event.title}
                      </p>
                      {(isLeader || isOwn) && event.overtimeAvailable && !isHidden && (
                        <span
                          style={{
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: "#FEF3C7",
                            color: "#D97706",
                            flexShrink: 0,
                          }}
                        >
                          특근
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                      <Clock style={{ width: 10, height: 10, color: "var(--text-tertiary)", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                        {event.allDay ? "종일" : `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`}
                      </span>
                    </div>
                    {!isHidden && event.description && (
                      <p
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-tertiary)",
                          marginTop: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {event.description}
                      </p>
                    )}
                  </div>

                  {group && (
                    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      <User style={{ width: 10, height: 10, color: "var(--text-tertiary)" }} />
                      <span style={{ fontSize: "0.68rem", color: "var(--text-tertiary)" }}>{memberName}</span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
