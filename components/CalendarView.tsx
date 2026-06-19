"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, EventClickArg, DatesSetArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, Clock, Search } from "lucide-react";
import EventModal from "./EventModal";
import DayEventsModal from "./DayEventsModal";
import EquipmentStockModal from "./EquipmentStockModal";
import EquipmentStatusIcon from "./EquipmentStatusIcon";
import { getEquipmentStock } from "./equipmentStock";
import PersonnelAvailabilityIcon from "./PersonnelAvailabilityIcon";
import PersonnelAvailabilityModal from "./PersonnelAvailabilityModal";
import { getPersonnelAvailability } from "./personnelAvailability";
import { isObserverRole } from "@/lib/groupPermissions";
import { isEffectivelyHoliday, type CustomHoliday as SharedCustomHoliday } from "@/lib/koreanHolidays";
import {
  addSeoulDays,
  compareSeoulDateKeys,
  formatSeoulDateKey,
  formatSeoulMonthDayWeekdayLabel,
  formatSeoulTimeLabel,
  formatSeoulYearMonthLabel,
  getSeoulDayRange,
} from "@/lib/seoulTime";

type Group = {
  id: string;
  name: string;
  leaderId: string;
  trackerOptions?: string | null;
  laptopOptions?: string | null;
  targetCount?: number;
  eventDisplayLimit?: number;
  members: Array<{
    id: string;
    userId: string;
    nickname: string | null;
    role: string;
    status?: string | null;
    user: { id: string; name: string | null; email: string | null; image: string | null };
  }>;
};

type CalEvent = {
  id: string;
  category?: "BUSINESS_TRIP" | "ATTENDANCE";
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string;
  overtimeAvailable: boolean;
  isOvertimeOnly: boolean;
  personnel: string | null;
  equipment?: string | null;
  creatorId: string;
  groupId: string | null;
  creatorNickname?: string | null;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
};

type CustomHoliday = SharedCustomHoliday;

type Props = {
  userId: string;
  group: Group | null;
  isLeader: boolean;
  isOperator: boolean;
  customHolidays?: CustomHoliday[];
  pendingEvent?: CalEvent | null;
  onPendingEventHandled?: () => void;
  pendingDayDate?: Date | null;
  onPendingDayDateHandled?: () => void;
  onEventSaved?: () => void;
};

// 한국 공휴일 (고정)
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ── Today 뷰 ──────────────────────────────────────────
function TodayView({
  events,
  group,
  onEventClick,
}: {
  events: CalEvent[];
  group: Group | null;
  onEventClick: (e: CalEvent) => void;
}) {
  const [showEquipmentStockModal, setShowEquipmentStockModal] = useState(false);
  const [showPersonnelAvailabilityModal, setShowPersonnelAvailabilityModal] = useState(false);
  const [dayNoteItems, setDayNoteItems] = useState<
    Array<{ id: string; text: string; assignee: string; startDate: string; endDate: string }>
  >([]);
  const [isDayNoteExpanded, setIsDayNoteExpanded] = useState(false);
  const today = new Date();
  const todayDateKey = formatSeoulDateKey(today);
  const todayRange = getSeoulDayRange(today);
  const todayEvents = events
    .filter((e) => {
      if (e.isOvertimeOnly) return false;
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      return start <= todayRange.end && end >= todayRange.start;
    })
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  const equipmentStock = getEquipmentStock(group, todayEvents);
  const personnelAvailability = getPersonnelAvailability(group, todayEvents);
  const effectiveDayNoteItems = group ? dayNoteItems : [];
  const hasDayNote = effectiveDayNoteItems.length > 0;
  const visibleDayNoteItems = isDayNoteExpanded ? effectiveDayNoteItems : effectiveDayNoteItems.slice(0, 1);
  const hiddenDayNoteCount = Math.max(effectiveDayNoteItems.length - visibleDayNoteItems.length, 0);

  const getMemberName = (event: CalEvent): string => {
    if (!group) return event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
    const member = group.members.find((m) => m.userId === event.creatorId);
    return member?.nickname || event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
  };

  useEffect(() => {
    if (!group) {
      return;
    }

    let cancelled = false;

    void fetch(`/api/day-notes?groupId=${group.id}&date=${todayDateKey}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("failed to load day note");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setDayNoteItems(data?.note?.items ?? []);
        setIsDayNoteExpanded(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDayNoteItems([]);
        setIsDayNoteExpanded(false);
      });

    return () => {
      cancelled = true;
    };
  }, [group, todayDateKey]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* 날짜 헤더 */}
      <div
        style={{
          padding: "12px 16px 10px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {formatSeoulMonthDayWeekdayLabel(today)}
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 2 }}>
          {todayEvents.length === 0 ? "오늘 일정 없음" : `${todayEvents.length}개 일정`}
        </p>
      </div>

      {/* 일정 목록 */}
      {group && equipmentStock?.hasConfiguredEquipment && (
        <button
          type="button"
          onClick={() => setShowEquipmentStockModal(true)}
          title="장비 현황"
          style={{
            position: "absolute",
            top: 12,
            right: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <EquipmentStatusIcon size={18} />
        </button>
      )}
      {group && personnelAvailability && (
        <button
          type="button"
          onClick={() => setShowPersonnelAvailabilityModal(true)}
          title="남아있는 인원"
          style={{
            position: "absolute",
            top: 12,
            right: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: personnelAvailability.remainingMembers.length > 0 ? "#2563EB" : "#DC2626",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <PersonnelAvailabilityIcon size={16} />
        </button>
      )}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, WebkitOverflowScrolling: "touch" as never, touchAction: "pan-y" }}>
        {hasDayNote && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface-raised)",
            }}
          >
            <p
              style={{
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              업무내용
            </p>
            <button
              type="button"
              onClick={() => setIsDayNoteExpanded((current) => !current)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 0,
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {visibleDayNoteItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border-subtle)",
                    background: "var(--surface)",
                  }}
                >
                  <span
                    style={{
                      marginTop: 6,
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: "var(--accent)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.text}
                    </p>
                    {item.assignee && (
                      <p
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        담당자 {item.assignee}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {(hiddenDayNoteCount > 0 || effectiveDayNoteItems.length > 1) && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-tertiary)",
                    paddingLeft: 2,
                  }}
                >
                  {isDayNoteExpanded ? "접기" : `외 ${hiddenDayNoteCount}개 더보기`}
                </span>
              )}
            </button>
          </div>
        )}
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
            const start = new Date(event.startDate);
            const end = new Date(event.endDate);
            const memberName = getMemberName(event);

            if (false && event.isOvertimeOnly) {
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
                    {event.title}
                  </p>

                  {/* 시간 */}
                  {!event.allDay && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Clock style={{ width: 11, height: 11, color: "var(--text-tertiary)", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {`${formatSeoulTimeLabel(start)} – ${formatSeoulTimeLabel(end)}`}
                      </span>
                    </div>
                  )}

                  {/* 설명 */}
                  {event.description && (
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

                  {/* 설명 끝 */}
                </div>

                {/* 인원 태그 */}
                {group && (
                  <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 600,
                      background: event.color + "20", color: event.color,
                      padding: "2px 8px", borderRadius: 10,
                    }}>
                      {event.personnel || memberName}
                    </span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
      {showEquipmentStockModal && equipmentStock && (
        <EquipmentStockModal
          stock={equipmentStock}
          title="장비 현황"
          subtitle={`${formatSeoulMonthDayWeekdayLabel(today)} 일정 기준`}
          onClose={() => setShowEquipmentStockModal(false)}
        />
      )}
      {showPersonnelAvailabilityModal && personnelAvailability && (
        <PersonnelAvailabilityModal
          availability={personnelAvailability}
          title="인원 현황"
          subtitle={`${formatSeoulMonthDayWeekdayLabel(today)} 일정 기준`}
          onClose={() => setShowPersonnelAvailabilityModal(false)}
        />
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function CalendarView({
  userId,
  group,
  isLeader,
  isOperator,
  customHolidays = [],
  pendingEvent,
  onPendingEventHandled,
  pendingDayDate,
  onPendingDayDateHandled,
  onEventSaved,
}: Props) {
  const isObserver = !!group?.members.find(
    (member) => member.userId === userId && isObserverRole(member.role)
  );
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date; allDay: boolean } | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "today">("month");
  const [dayPopup, setDayPopup] = useState<{ date: Date; events: CalEvent[] } | null>(null);
  const [currentMonthLabel, setCurrentMonthLabel] = useState(() =>
    formatSeoulYearMonthLabel(new Date())
  );
  const eventDisplayLimit = Math.max(1, Math.min(10, group?.eventDisplayLimit ?? 3));
  const calendarRef = useRef<FullCalendar>(null);
  const calendarWrapRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const params = group ? `?groupId=${group.id}` : "";
      const res = await fetch(`/api/events${params}`);
      if (res.ok) setEvents(await res.json());
    } catch {
      // network error — keep existing events
    }
  }, [group]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchEvents();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchEvents]);

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
    if (!pendingEvent) return;

    const timeoutId = window.setTimeout(() => {
      setSelectedEvent(pendingEvent);
      setSelectedDates(null);
      setShowModal(true);
      onPendingEventHandled?.();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pendingEvent, onPendingEventHandled]);

  const calendarEvents: EventInput[] = events
    .filter((e) => !e.isOvertimeOnly && (e.category ?? "BUSINESS_TRIP") !== "ATTENDANCE")
    .map((e) => {
      let startValue: Date | string = e.startDate;
      let endValue: Date | string = e.endDate;
      if (e.allDay) {
        startValue = formatSeoulDateKey(e.startDate);
        endValue = formatSeoulDateKey(addSeoulDays(e.endDate, 1));
      }
      return {
        id: e.id,
        title: e.title,
        start: startValue,
        end: endValue,
        allDay: e.allDay,
        backgroundColor: e.color + "28",
        borderColor: "transparent",
        textColor: e.color,
        extendedProps: { event: e },
      };
    });

  const openDayPopup = useCallback((date: Date) => {
    const { start: s, end: e } = getSeoulDayRange(date);
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
    if (!pendingDayDate) return;

    const timeoutId = window.setTimeout(() => {
      openDayPopup(pendingDayDate);
      onPendingDayDateHandled?.();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pendingDayDate, openDayPopup, onPendingDayDateHandled]);

  // 팝업이 열려있는 상태에서 events가 갱신되면 팝업 내용도 갱신 (닫지 않음)
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDayPopup((prev) => {
        if (!prev) return null;
        const { start: s, end: e } = getSeoulDayRange(prev.date);
        const updated = events
          .filter((ev) => new Date(ev.startDate) <= e && new Date(ev.endDate) >= s)
          .sort((a, b) => {
            if (a.allDay && !b.allDay) return -1;
            if (!a.allDay && b.allDay) return 1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          });
        return { ...prev, events: updated };
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [events]);

  const handleDateClick = (info: DateClickArg) => {
    openDayPopup(info.date);
  };

  const getClickedSegmentDate = (info: EventClickArg): Date | null => {
    const target = info.jsEvent.target;
    if (!(target instanceof Element)) return null;

    const dayCell = target.closest("[data-date]");
    if (!dayCell) return null;

    const clickedDate = dayCell.getAttribute("data-date");
    if (!clickedDate) return null;

    const parsed = new Date(clickedDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const handleEventClick = (info: EventClickArg) => {
    const date = getClickedSegmentDate(info) ?? info.event.start ?? new Date();
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

  const handleSummaryToggle = () => {
    setViewMode((current) => (current === "today" ? "month" : "today"));
  };

  const handlePrevMonth = () => {
    calendarWrapRef.current?.classList.add("fc-swipe-prev");
    calendarRef.current?.getApi().prev();
    setTimeout(() => calendarWrapRef.current?.classList.remove("fc-swipe-prev"), 350);
  };

  const handleNextMonth = () => {
    calendarWrapRef.current?.classList.add("fc-swipe-next");
    calendarRef.current?.getApi().next();
    setTimeout(() => calendarWrapRef.current?.classList.remove("fc-swipe-next"), 350);
  };

  const handleTodayClick = () => {
    if (viewMode === "today") {
      setViewMode("month");
    }
    requestAnimationFrame(() => {
      calendarRef.current?.getApi().today();
    });
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setCurrentMonthLabel(formatSeoulYearMonthLabel(arg.view.currentStart));
  };

  const toolbarButtonStyle: CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    borderRadius: 7,
    fontSize: "0.78rem",
    fontWeight: 500,
    padding: 0,
    boxShadow: "none",
    transition: "all 0.12s ease",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    height: 30,
  };

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
          alignItems: "center",
          gap: 6,
          padding: "12px 16px 0",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleSummaryToggle}
          title="Summary"
          style={{
            ...toolbarButtonStyle,
            width: 30,
            borderColor: viewMode === "today" ? "var(--accent)" : "var(--border)",
            background: viewMode === "today" ? "var(--accent-light)" : "var(--surface)",
            color: viewMode === "today" ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          <Search style={{ width: 14, height: 14 }} />
        </button>

        {viewMode === "month" && (
          <>
            <div style={{ width: 1, height: 18, background: "var(--border)", flexShrink: 0 }} />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <button type="button" onClick={handlePrevMonth} title="이전 달" style={{ ...toolbarButtonStyle, width: 30 }}>
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                  textAlign: "center",
                  fontSize: "0.925rem",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                }}
              >
                {currentMonthLabel}
              </div>
              <button type="button" onClick={handleNextMonth} title="다음 달" style={{ ...toolbarButtonStyle, width: 30 }}>
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div style={{ width: 1, height: 18, background: "var(--border)", flexShrink: 0 }} />
            <button
              type="button"
              onClick={handleTodayClick}
              style={{
                ...toolbarButtonStyle,
                padding: "0 10px",
                fontWeight: 700,
                color: "var(--accent)",
                background: "var(--accent-light)",
                borderColor: "var(--accent-light)",
              }}
            >
              Today
            </button>
          </>
        )}
      </div>

      {/* 뷰 영역 */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", padding: viewMode === "today" ? 0 : 12 }}>
        {viewMode === "today" ? (
          <TodayView
            events={events}
            group={group}
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
            headerToolbar={false}
            locale="ko"
            timeZone="Asia/Seoul"
            datesSet={handleDatesSet}
            dayHeaderContent={(arg) => {
              const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
              return DAYS[arg.date.getDay()];
            }}
            events={calendarEvents}
            dayMaxEvents={eventDisplayLimit}
            dayCellContent={(arg) => arg.date.getDate()}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            moreLinkClick={(arg) => { openDayPopup(arg.date); return false as unknown as "popover"; }}
            height="100%"
            dayCellClassNames={(arg) => {
              const classes: string[] = [];
              const ds = formatSeoulDateKey(arg.date);
              const custom = customHolidays.find((h) => h.date === ds);
              if (custom?.type === "holiday") {
                classes.push("fc-day-gray", "fc-day-custom-holiday");
              } else if (custom?.type === "workday") {
                classes.push("fc-day-custom-workday");
              } else if (isWeekend(arg.date) || isEffectivelyHoliday(arg.date, customHolidays)) {
                classes.push("fc-day-gray");
              }
              const hasOvertime = events.some((e) => {
                if (!e.overtimeAvailable) return false;
                if (!isLeader && e.creatorId !== userId) return false;
                return compareSeoulDateKeys(ds, e.startDate) >= 0 && compareSeoulDateKeys(ds, e.endDate) <= 0;
              });
              const hasAttendance = events.some((e) => {
                if (e.isOvertimeOnly) return false;
                if ((e.category ?? "BUSINESS_TRIP") !== "ATTENDANCE") return false;
                return compareSeoulDateKeys(ds, e.startDate) >= 0 && compareSeoulDateKeys(ds, e.endDate) <= 0;
              });
              if (hasOvertime) classes.push("fc-day-overtime");
              if (hasAttendance) classes.push("fc-day-attendance");
              return classes;
            }}
            eventContent={(info) => (
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
                  {info.event.title}
                </div>
              </div>
            )}
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
          isOperator={isOperator}
          isObserver={isObserver}
          customHolidays={customHolidays}
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
