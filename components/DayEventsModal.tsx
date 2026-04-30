"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarClock, Clock, Plus, X } from "lucide-react";

const FIXED_HOLIDAYS: Record<string, string> = {
  "01-01": "신정", "03-01": "삼일절", "05-05": "어린이날",
  "06-06": "현충일", "08-15": "광복절", "10-03": "개천절",
  "10-09": "한글날", "12-25": "크리스마스",
};
const LUNAR_HOLIDAYS: Record<string, string> = {
  "2025-01-28": "설 연휴", "2025-01-29": "설날", "2025-01-30": "설 연휴",
  "2025-05-05": "부처님오신날", "2025-10-05": "추석 연휴", "2025-10-06": "추석", "2025-10-07": "추석 연휴",
  "2026-02-16": "설 연휴", "2026-02-17": "설날", "2026-02-18": "설 연휴",
  "2026-05-24": "부처님오신날", "2026-09-23": "추석 연휴", "2026-09-24": "추석", "2026-09-25": "추석 연휴",
};
function getHolidayName(date: Date): string | null {
  return FIXED_HOLIDAYS[format(date, "MM-dd")] || LUNAR_HOLIDAYS[format(date, "yyyy-MM-dd")] || null;
}

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
  personnel: string | null;
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

type CustomHoliday = {
  id: string;
  date: string;
  name: string;
  type: "holiday" | "workday";
};

type Props = {
  date: Date;
  events: CalEvent[];
  userId: string;
  group: Group | null;
  isLeader: boolean;
  customHolidays?: CustomHoliday[];
  onEventClick: (event: CalEvent) => void;
  onAddClick: () => void;
  onClose: () => void;
  onRefresh: () => void;
};

export default function DayEventsModal({ date, events, userId, group, isLeader, customHolidays = [], onEventClick, onAddClick, onClose, onRefresh }: Props) {
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<'available' | 'unavailable' | null | undefined>(undefined);

  const getMemberName = (event: CalEvent) => {
    if (!group) return event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
    const member = group.members.find((m) => m.userId === event.creatorId);
    return member?.nickname || event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
  };

  const myOvertimeEvent = events.find(
    (e) => e.isOvertimeOnly && e.creatorId === userId &&
      format(new Date(e.startDate), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
  );
  const overtimeStatus: 'available' | 'unavailable' | null = myOvertimeEvent
    ? (myOvertimeEvent.overtimeAvailable ? 'available' : 'unavailable')
    : null;

  // events가 갱신되면 optimistic 상태 초기화
  useEffect(() => {
    setLocalStatus(undefined);
  }, [events]);

  const effectiveStatus = localStatus !== undefined ? localStatus : overtimeStatus;

  const handleOvertimeSelect = async (choice: 'available' | 'unavailable') => {
    if (overtimeLoading) return;
    setOvertimeLoading(true);
    const isSameChoice = !!(myOvertimeEvent && (
      (choice === 'available' && myOvertimeEvent.overtimeAvailable) ||
      (choice === 'unavailable' && !myOvertimeEvent.overtimeAvailable)
    ));
    setLocalStatus(isSameChoice ? null : choice);
    try {
      if (myOvertimeEvent) {
        const r = await fetch(`/api/events/${myOvertimeEvent.id}`, { method: "DELETE" });
        if (!r.ok) throw new Error("delete failed");
      }
      if (!isSameChoice) {
        const dateStr = format(date, "yyyy-MM-dd");
        const r = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: choice === 'available' ? "특근 가능" : "특근 불가능",
            startDate: `${dateStr}T00:00:00`,
            endDate: `${dateStr}T00:00:00`,
            allDay: true,
            color: choice === 'available' ? "#F59E0B" : "#EF4444",
            isPrivate: false,
            overtimeAvailable: choice === 'available',
            isOvertimeOnly: true,
            groupId: group?.id ?? null,
          }),
        });
        if (!r.ok) throw new Error("create failed");
      }
      onRefresh();
    } catch {
      setLocalStatus(undefined);
    } finally {
      setOvertimeLoading(false);
    }
  };

  const overtimePeopleAvailable = events.filter(e => e.isOvertimeOnly && e.creatorId !== userId && e.overtimeAvailable);
  const overtimePeopleUnavailable = events.filter(e => e.isOvertimeOnly && e.creatorId !== userId && !e.overtimeAvailable);

  // 일반 이벤트만
  const normalEvents = events.filter(e => !e.isOvertimeOnly);
  const visibleEvents = normalEvents.filter(e => !e.isPrivate || e.creatorId === userId || isLeader);
  const sorted = [...visibleEvents].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const dateStr = format(date, "yyyy-MM-dd");
  const customEntry = customHolidays.find((h) => h.date === dateStr);
  const holidayName = customEntry?.type === "workday"
    ? "대체 근무일"
    : (customEntry?.name ?? getHolidayName(date));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-scale-in"
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 420,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: "18px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <p style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                {format(date, "M월 d일 (E)", { locale: ko })}
              </p>
              {holidayName && (
                <span style={{
                  fontSize: "0.72rem", fontWeight: 600,
                  color: customEntry?.type === "workday" ? "var(--accent)" : "#EF4444",
                }}>{holidayName}</span>
              )}
            </div>
            <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 2 }}>
              {sorted.length === 0 ? "일정 없음" : `${sorted.length}개 일정`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 7, color: "var(--text-tertiary)", display: "flex", transition: "background 0.1s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* 특근 섹션 (그룹 있을 때만) */}
        {group && (
          <div style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            background: effectiveStatus === 'available'
              ? "var(--accent-light)"
              : effectiveStatus === 'unavailable'
              ? "rgba(239,68,68,0.07)"
              : "var(--surface-raised)",
            transition: "background 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: effectiveStatus === 'available'
                    ? "var(--accent-muted)"
                    : effectiveStatus === 'unavailable'
                    ? "rgba(239,68,68,0.15)"
                    : "var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s", flexShrink: 0,
                }}>
                  <CalendarClock style={{
                    width: 14, height: 14,
                    color: effectiveStatus === 'available'
                      ? "var(--accent)"
                      : effectiveStatus === 'unavailable'
                      ? "#EF4444"
                      : "var(--text-tertiary)",
                  }} />
                </div>
                <div>
                  <p style={{
                    fontSize: "0.825rem", fontWeight: 700, letterSpacing: "-0.01em",
                    color: effectiveStatus === 'available'
                      ? "var(--accent-hover)"
                      : effectiveStatus === 'unavailable'
                      ? "#EF4444"
                      : "var(--text-primary)",
                  }}>
                    특근
                  </p>
                  <p style={{
                    fontSize: "0.68rem", marginTop: 1,
                    color: effectiveStatus === 'available'
                      ? "var(--accent)"
                      : effectiveStatus === 'unavailable'
                      ? "#EF4444"
                      : "var(--text-tertiary)",
                  }}>
                    {effectiveStatus === 'available'
                      ? "이 날 특근 가능으로 표시됨"
                      : effectiveStatus === 'unavailable'
                      ? "이 날 특근 불가능으로 표시됨"
                      : "특근 가능 여부를 알려주세요"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleOvertimeSelect('unavailable')}
                  disabled={overtimeLoading}
                  style={{
                    padding: "4px 12px", borderRadius: 20, fontFamily: "inherit",
                    border: `1.5px solid ${effectiveStatus === 'unavailable' ? "#EF4444" : "var(--border)"}`,
                    background: effectiveStatus === 'unavailable' ? "#EF4444" : "transparent",
                    color: effectiveStatus === 'unavailable' ? "#fff" : "var(--text-secondary)",
                    fontSize: "0.75rem", fontWeight: 600,
                    cursor: overtimeLoading ? "not-allowed" : "pointer",
                    transition: "all 0.18s", opacity: overtimeLoading ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  {effectiveStatus === 'unavailable' && <span style={{ fontSize: "0.65rem", lineHeight: 1 }}>✓</span>}
                  불가능
                </button>
                <button
                  type="button"
                  onClick={() => handleOvertimeSelect('available')}
                  disabled={overtimeLoading}
                  style={{
                    padding: "4px 12px", borderRadius: 20, fontFamily: "inherit",
                    border: `1.5px solid ${effectiveStatus === 'available' ? "var(--accent)" : "var(--border)"}`,
                    background: effectiveStatus === 'available' ? "var(--accent)" : "transparent",
                    color: effectiveStatus === 'available' ? "#fff" : "var(--text-secondary)",
                    fontSize: "0.75rem", fontWeight: 600,
                    cursor: overtimeLoading ? "not-allowed" : "pointer",
                    transition: "all 0.18s", opacity: overtimeLoading ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  {effectiveStatus === 'available' && <span style={{ fontSize: "0.65rem", lineHeight: 1 }}>✓</span>}
                  가능
                </button>
              </div>
            </div>

            {/* 가능자 / 불가능자 태그 목록 */}
            {(overtimePeopleAvailable.length > 0 || effectiveStatus === 'available' || (isLeader && (overtimePeopleUnavailable.length > 0 || effectiveStatus === 'unavailable'))) && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {(overtimePeopleAvailable.length > 0 || effectiveStatus === 'available') && (
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", columnGap: 6 }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>
                      가능:
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {overtimePeopleAvailable.map((ev) => (
                      <span key={ev.id} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: "0.68rem", background: "var(--accent-light)", color: "var(--accent)",
                        padding: "2px 8px", borderRadius: 10, fontWeight: 600,
                        border: "1px solid var(--accent-muted)",
                      }}>
                        {getMemberName(ev)}
                        {isLeader && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await fetch(`/api/events/${ev.id}`, { method: "DELETE" });
                              onRefresh();
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--accent)", lineHeight: 1 }}
                          >
                            <X style={{ width: 10, height: 10 }} />
                          </button>
                        )}
                      </span>
                    ))}
                    {effectiveStatus === 'available' && (
                      <span style={{ fontSize: "0.68rem", background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                        나
                      </span>
                    )}
                    </div>
                  </div>
                )}
                {isLeader && (overtimePeopleUnavailable.length > 0 || effectiveStatus === 'unavailable') && (
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", columnGap: 6 }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "#EF4444", whiteSpace: "nowrap" }}>
                      불가능:
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {overtimePeopleUnavailable.map((ev) => (
                      <span key={ev.id} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: "0.68rem", background: "rgba(239,68,68,0.1)", color: "#EF4444",
                        padding: "2px 8px", borderRadius: 10, fontWeight: 600,
                        border: "1px solid rgba(239,68,68,0.2)",
                      }}>
                        {getMemberName(ev)}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await fetch(`/api/events/${ev.id}`, { method: "DELETE" });
                            onRefresh();
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#EF4444", lineHeight: 1 }}
                        >
                          <X style={{ width: 10, height: 10 }} />
                        </button>
                      </span>
                    ))}
                    {effectiveStatus === 'unavailable' && (
                      <span style={{ fontSize: "0.68rem", background: "#EF4444", color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                        나
                      </span>
                    )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 일정 목록 */}
        <div style={{
          padding: "12px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 320,
          overflowY: "auto",
        }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-tertiary)" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                </svg>
              </div>
              <p style={{ fontSize: "0.875rem" }}>이 날 일정이 없습니다</p>
            </div>
          ) : (
            sorted.map((event, idx) => {
              const isOwn = event.creatorId === userId;
              const isHidden = event.isPrivate && !isOwn && !isLeader;
              const start = new Date(event.startDate);
              const end = new Date(event.endDate);
              const creatorName = event.personnel || getMemberName(event);

              return (
                <button
                  key={event.id}
                  className="stagger-item"
                  onClick={() => onEventClick(event)}
                  style={{
                    animationDelay: `${idx * 28}ms`,
                    display: "flex",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--surface-raised)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    transition: "background 0.1s",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                >
                  {/* 왼쪽 컬러 바 */}
                  <div style={{ width: 4, borderRadius: 4, flexShrink: 0, background: event.color, alignSelf: "stretch" }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{
                        fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)",
                        letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                      }}>
                        {isHidden ? "비공개 일정" : event.title}
                      </p>
                      {(isLeader || isOwn) && event.overtimeAvailable && !isHidden && (
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "var(--accent-light)", color: "var(--accent)", flexShrink: 0 }}>
                          특근
                        </span>
                      )}
                    </div>

                    {/* 시간 */}
                    {event.allDay && format(start, "yyyy-MM-dd") !== format(end, "yyyy-MM-dd") && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                        <Clock style={{ width: 11, height: 11, color: "var(--text-tertiary)", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {`${format(start, "MM/dd")} – ${format(end, "MM/dd")}`}
                        </span>
                      </div>
                    )}
                    {!event.allDay && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                        <Clock style={{ width: 11, height: 11, color: "var(--text-tertiary)", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {`${format(start, "HH:mm")} – ${format(end, "HH:mm")}`}
                        </span>
                      </div>
                    )}
                    {!isHidden && event.description && (
                      <p style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {event.description}
                      </p>
                    )}

                    {/* 작성자 태그 */}
                    {group && !isHidden && (
                      <div style={{ marginTop: 6 }}>
                        <span style={{
                          fontSize: "0.68rem", fontWeight: 600,
                          background: event.color + "20", color: event.color,
                          padding: "2px 8px", borderRadius: 10,
                        }}>
                          {creatorName}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 일정 추가 버튼 */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onAddClick}
            style={{
              width: "100%", padding: "10px", borderRadius: 9,
              border: "1.5px dashed var(--border)", background: "none",
              color: "var(--text-tertiary)", fontSize: "0.825rem", fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            일정 추가
          </button>
        </div>
      </div>
    </div>
  );
}
