"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, EventClickArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { format, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { Clock, User } from "lucide-react";
import EventModal from "./EventModal";
import DayEventsModal from "./DayEventsModal";

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
  creatorNickname?: string | null;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
};

type Props = {
  userId: string;
  userName: string;
  group: Group | null;
  isLeader: boolean;
  pendingEvent?: CalEvent | null;
  onPendingEventHandled?: () => void;
  pendingDayDate?: Date | null;
  onPendingDayDateHandled?: () => void;
  onEventSaved?: () => void;
};

// 한국 공휴일 (고정)
const FIXED_HOLIDAYS: Record<string, string> = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "크리스마스",
};

// 음력 기반 공휴일 (2025~2026 양력 변환)
const LUNAR_HOLIDAYS: Record<string, string> = {
  "2025-01-28": "설 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설 연휴",
  "2025-05-05": "부처님오신날",
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  "2026-02-16": "설 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설 연휴",
  "2026-05-24": "부처님오신날",
  "2026-09-23": "추석 연휴",
  "2026-09-24": "추석",
  "2026-09-25": "추석 연휴",
};

function isHoliday(date: Date): boolean {
  const mmdd = format(date, "MM-dd");
  const yyyy_mm_dd = format(date, "yyyy-MM-dd");
  return mmdd in FIXED_HOLIDAYS || yyyy_mm_dd in LUNAR_HOLIDAYS;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ── Today 뷰 ──────────────────────────────────────────
function TodayView({
  events,
  userId,
  group,
  isLeader,
  onEventClick,
}: {
  events: CalEvent[];
  userId: string;
  group: Group | null;
  isLeader: boolean;
  onEventClick: (e: CalEvent) => void;
}) {
  const today = new Date();
  const todayEvents = events
    .filter((e) => {
      if (e.isOvertimeOnly && !isLeader && e.creatorId !== userId) return false;
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      return start <= todayEnd && end >= todayStart;
    })
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

  const getMemberName = (event: CalEvent): string => {
    if (!group) return event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
    const member = group.members.find((m) => m.userId === event.creatorId);
    return member?.nickname || event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* 날짜 헤더 */}
      <div
        style={{
          padding: "12px 16px 10px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {format(today, "M월 d일 (E)", { locale: ko })}
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 2 }}>
          {todayEvents.length === 0 ? "오늘 일정 없음" : `${todayEvents.length}개 일정`}
        </p>
      </div>

      {/* 일정 목록 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, WebkitOverflowScrolling: "touch" as never, touchAction: "pan-y" }}>
        {todayEvents.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-tertiary)",
              gap: 8,
            }}
          >
            <Clock style={{ width: 36, height: 36, opacity: 0.3 }} />
            <p style={{ fontSize: "0.875rem" }}>오늘 예정된 일정이 없습니다</p>
          </div>
        ) : (
          todayEvents.map((event) => {
            const isOwn = event.creatorId === userId;
            const isHidden = event.isPrivate && !isOwn && !isLeader;
            const start = new Date(event.startDate);
            const end = new Date(event.endDate);
            const memberName = getMemberName(event);

            if (event.isOvertimeOnly) {
              return (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    border: "1px solid #FDE68A",
                    borderRadius: 10,
                    background: "#FFFBEB",
                  }}
                >
                  <div style={{ width: 4, borderRadius: 4, flexShrink: 0, backgroundColor: "#F59E0B", alignSelf: "stretch" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#92400E" }}>특근 가능</p>
                    {group && (
                      <p style={{ fontSize: "0.72rem", color: "#B45309", marginTop: 2 }}>{memberName}</p>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 12,
                  padding: "12px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "background 0.1s ease, border-color 0.1s ease",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-hover)";
                  e.currentTarget.style.borderColor = "var(--text-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--surface)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                {/* 색상 바 */}
                <div
                  style={{
                    width: 4,
                    borderRadius: 4,
                    flexShrink: 0,
                    backgroundColor: event.color,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* 제목 */}
                  <p
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      letterSpacing: "-0.01em",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isHidden ? "비공개 일정" : event.title}
                  </p>

                  {/* 시간 */}
                  {!event.allDay && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Clock style={{ width: 11, height: 11, color: "var(--text-tertiary)", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {`${format(start, "HH:mm")} – ${format(end, "HH:mm")}`}
                      </span>
                    </div>
                  )}

                  {/* 설명 */}
                  {!isHidden && event.description && (
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {event.description}
                    </p>
                  )}
                </div>

                {/* 인원 */}
                {group && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <User style={{ width: 11, height: 11, color: "var(--text-tertiary)" }} />
                    <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>{event.personnel || memberName}</span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function CalendarView({
  userId,
  userName,
  group,
  isLeader,
  pendingEvent,
  onPendingEventHandled,
  pendingDayDate,
  onPendingDayDateHandled,
  onEventSaved,
}: Props) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date; allDay: boolean } | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "today">("month");
  const [dayPopup, setDayPopup] = useState<{ date: Date; events: CalEvent[] } | null>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const calendarWrapRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const fetchEvents = useCallback(async () => {
    const params = group ? `?groupId=${group.id}` : "";
    const res = await fetch(`/api/events${params}`);
    if (res.ok) setEvents(await res.json());
  }, [group]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // SSE 실시간 업데이트 + 탭 포커스 새로고침
  useEffect(() => {
    if (!group) return;
    const es = new EventSource(`/api/events/stream?groupId=${group.id}`);
    es.onmessage = () => fetchEvents();
    const onFocus = () => fetchEvents();
    window.addEventListener("focus", onFocus);
    return () => {
      es.close();
      window.removeEventListener("focus", onFocus);
    };
  }, [group, fetchEvents]);

  useEffect(() => {
    if (pendingEvent) {
      setSelectedEvent(pendingEvent);
      setSelectedDates(null);
      setShowModal(true);
      onPendingEventHandled?.();
    }
  }, [pendingEvent, onPendingEventHandled]);

  const calendarEvents: EventInput[] = events
    .filter((e) => !e.isOvertimeOnly)
    .map((e) => {
      const isOwn = e.creatorId === userId;
      let endValue: Date | string = e.endDate;
      if (e.allDay) {
        const d = new Date(e.endDate);
        d.setDate(d.getDate() + 1);
        endValue = d;
      }
      return {
        id: e.id,
        title: e.isPrivate && !isOwn && !isLeader ? "비공개 일정" : e.title,
        start: e.startDate,
        end: endValue,
        allDay: e.allDay,
        backgroundColor: e.color + "28",
        borderColor: "transparent",
        textColor: e.color,
        extendedProps: { event: e },
      };
    });

  const openDayPopup = useCallback((date: Date) => {
    const s = new Date(date);
    s.setHours(0, 0, 0, 0);
    const e = new Date(date);
    e.setHours(23, 59, 59, 999);
    const dayEvents = events
      .filter((ev) => new Date(ev.startDate) <= e && new Date(ev.endDate) >= s)
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
    setDayPopup({ date, events: dayEvents });
  }, [events]);

  useEffect(() => {
    if (pendingDayDate) {
      openDayPopup(pendingDayDate);
      onPendingDayDateHandled?.();
    }
  }, [pendingDayDate, openDayPopup, onPendingDayDateHandled]);

  // 팝업이 열려있는 상태에서 events가 갱신되면 팝업 내용도 갱신 (닫지 않음)
  useEffect(() => {
    setDayPopup((prev) => {
      if (!prev) return null;
      const s = new Date(prev.date); s.setHours(0, 0, 0, 0);
      const e = new Date(prev.date); e.setHours(23, 59, 59, 999);
      const updated = events
        .filter((ev) => new Date(ev.startDate) <= e && new Date(ev.endDate) >= s)
        .sort((a, b) => {
          if (a.allDay && !b.allDay) return -1;
          if (!a.allDay && b.allDay) return 1;
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
      return { ...prev, events: updated };
    });
  }, [events]);

  const handleDateClick = (info: DateClickArg) => {
    openDayPopup(info.date);
  };

  const handleEventClick = (info: EventClickArg) => {
    const date = info.event.start ?? new Date();
    openDayPopup(date);
  };

  useEffect(() => {
    const el = calendarWrapRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = touchStartX.current - e.changedTouches[0].clientX;
      const dy = touchStartY.current - e.changedTouches[0].clientY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        const api = calendarRef.current?.getApi();
        const direction = dx > 0 ? "fc-swipe-next" : "fc-swipe-prev";
        el.classList.add(direction);
        if (dx > 0) api?.next();
        else api?.prev();
        setTimeout(() => el.classList.remove(direction), 350);
      }
      touchStartX.current = null;
      touchStartY.current = null;
    };
    el.addEventListener("touchstart", onStart, { passive: true, capture: true });
    el.addEventListener("touchend", onEnd, { passive: true, capture: true });
    return () => {
      el.removeEventListener("touchstart", onStart, { capture: true });
      el.removeEventListener("touchend", onEnd, { capture: true });
    };
  }, []);

  const handleEventSaved = () => {
    setShowModal(false);
    fetchEvents();
    onEventSaved?.();
  };

  const tabBtn = (mode: "month" | "today", label: string) => (
    <button
      onClick={() => setViewMode(viewMode === mode ? "month" : mode)}
      style={{
        padding: "5px 12px",
        borderRadius: 6,
        border: "1px solid",
        borderColor: viewMode === mode ? "var(--accent)" : "var(--border)",
        background: viewMode === mode ? "var(--accent-light)" : "transparent",
        color: viewMode === mode ? "var(--accent)" : "var(--text-secondary)",
        fontSize: "0.75rem",
        fontWeight: viewMode === mode ? 700 : 400,
        cursor: "pointer",
        fontFamily: "inherit",
        letterSpacing: "-0.01em",
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        height: "100%",
        background: "var(--surface)",
        borderRadius: 12,
        border: "1px solid var(--border)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 1px 3px rgba(30,41,59,0.08), 0 1px 2px rgba(30,41,59,0.04)",
      }}
    >
      {/* 뷰 탭 */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 14px 0",
          flexShrink: 0,
        }}
      >
        {tabBtn("today", "Summary")}
      </div>

      {/* 뷰 영역 */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", padding: viewMode === "today" ? 0 : 12 }}>
        {viewMode === "today" ? (
          <TodayView
            events={events}
            userId={userId}
            group={group}
            isLeader={isLeader}
            onEventClick={(e) => {
              setSelectedEvent(e);
              setSelectedDates(null);
              setShowModal(true);
            }}
          />
        ) : (
          <div
            ref={calendarWrapRef}
            style={{ flex: 1, minHeight: 0 }}
          >
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev",
              center: "title",
              right: "next sep today",
            }}
            buttonText={{ today: "Today" }}
            locale="ko"
            customButtons={{
              prev: {
                icon: "chevron-left",
                click: () => {
                  calendarWrapRef.current?.classList.add("fc-swipe-prev");
                  calendarRef.current?.getApi().prev();
                  setTimeout(() => calendarWrapRef.current?.classList.remove("fc-swipe-prev"), 350);
                },
              },
              next: {
                icon: "chevron-right",
                click: () => {
                  calendarWrapRef.current?.classList.add("fc-swipe-next");
                  calendarRef.current?.getApi().next();
                  setTimeout(() => calendarWrapRef.current?.classList.remove("fc-swipe-next"), 350);
                },
              },
              sep: {
                text: "",
                click: () => {},
              },
            }}
            dayHeaderContent={(arg) => {
              const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
              return DAYS[arg.date.getDay()];
            }}
            events={calendarEvents}
            dayMaxEvents={3}
            dayCellContent={(arg) => arg.date.getDate()}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            moreLinkClick={(arg) => { openDayPopup(arg.date); return false as unknown as "popover"; }}
            height="100%"
            dayCellClassNames={(arg) => {
              const classes: string[] = [];
              if (isWeekend(arg.date) || isHoliday(arg.date)) classes.push("fc-day-gray");
              const ds = format(arg.date, "yyyy-MM-dd");
              const hasOvertime = events.some((e) => {
                if (!e.overtimeAvailable) return false;
                if (!isLeader && e.creatorId !== userId) return false;
                const s = format(new Date(e.startDate), "yyyy-MM-dd");
                const en = format(new Date(e.endDate), "yyyy-MM-dd");
                return ds >= s && ds <= en;
              });
              if (hasOvertime) classes.push("fc-day-overtime");
              return classes;
            }}
            eventContent={(info) => {
              const calEvent = info.event.extendedProps.event as CalEvent | undefined;
              const description = calEvent?.description;
              const personnel = calEvent?.personnel;

              let showText: boolean;
              if (info.isStart && info.isEnd) {
                showText = true;
              } else if (info.isStart || info.isEnd) {
                const evStart = info.event.start!;
                const evEnd = info.event.end ?? evStart;
                const startSegLen = 7 - evStart.getDay();
                const endSegLen = evEnd.getDay() || 7;
                showText = info.isStart ? startSegLen >= endSegLen : endSegLen > startSegLen;
              } else {
                showText = true;
              }

              if (!showText) return <div style={{ width: "100%", height: "100%" }} />;

              const label = [
                info.event.title,
                description ? `· ${description}` : "",
                personnel ? `· ${personnel}` : "",
              ].filter(Boolean).join(" ");
              return (
                <div style={{
                  padding: "2px 4px",
                  overflow: "hidden",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <div style={{
                    fontSize: "0.62rem",
                    fontWeight: 600,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                    textAlign: "center",
                  }}>
                    {label}
                  </div>
                </div>
              );
            }}
          />
          </div>
        )}
      </div>

      {dayPopup && (
        <DayEventsModal
          date={dayPopup.date}
          events={dayPopup.events}
          userId={userId}
          group={group}
          isLeader={isLeader}
          onEventClick={(e) => {
            setDayPopup(null);
            setSelectedEvent(e);
            setSelectedDates(null);
            setShowModal(true);
          }}
          onAddClick={() => {
            setDayPopup(null);
            setSelectedDates({ start: dayPopup.date, end: dayPopup.date, allDay: true });
            setSelectedEvent(null);
            setShowModal(true);
          }}
          onClose={() => setDayPopup(null)}
          onRefresh={() => {
            fetchEvents();
          }}
        />
      )}

      {showModal && (
        <EventModal
          userId={userId}
          userName={userName}
          group={group}
          isLeader={isLeader}
          event={selectedEvent}
          initialDates={selectedDates}
          onSaved={handleEventSaved}
          onDeleted={handleEventSaved}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
