"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, DateSelectArg, EventClickArg } from "@fullcalendar/core";
import EventModal from "./EventModal";

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
  creatorId: string;
  groupId: string | null;
  creatorNickname?: string | null;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
};

type Props = {
  userId: string;
  group: Group | null;
  isLeader: boolean;
  pendingEvent?: CalEvent | null;
  onPendingEventHandled?: () => void;
  onEventSaved?: () => void;
};

export default function CalendarView({
  userId,
  group,
  isLeader,
  pendingEvent,
  onPendingEventHandled,
  onEventSaved,
}: Props) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date; allDay: boolean } | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const fetchEvents = useCallback(async () => {
    const params = group ? `?groupId=${group.id}` : "";
    const res = await fetch(`/api/events${params}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data);
    }
  }, [group]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // 요약 패널에서 클릭한 이벤트 열기
  useEffect(() => {
    if (pendingEvent) {
      setSelectedEvent(pendingEvent);
      setSelectedDates(null);
      setShowModal(true);
      onPendingEventHandled?.();
    }
  }, [pendingEvent, onPendingEventHandled]);

  const calendarEvents: EventInput[] = events.map((e) => {
    const isOwn = e.creatorId === userId;
    return {
      id: e.id,
      title: e.isPrivate && !isOwn && !isLeader ? "비공개 일정" : e.title,
      start: e.startDate,
      end: e.endDate,
      allDay: e.allDay,
      backgroundColor: e.color,
      borderColor: e.color,
      extendedProps: { event: e },
    };
  });

  const handleDateSelect = (info: DateSelectArg) => {
    setSelectedDates({ start: info.start, end: info.end, allDay: info.allDay });
    setSelectedEvent(null);
    setShowModal(true);
  };

  const handleEventClick = (info: EventClickArg) => {
    const event = info.event.extendedProps.event as CalEvent;
    setSelectedEvent(event);
    setSelectedDates(null);
    setShowModal(true);
  };

  const handleEventSaved = () => {
    setShowModal(false);
    fetchEvents();
    onEventSaved?.();
  };

  const handleEventDeleted = () => {
    setShowModal(false);
    fetchEvents();
    onEventSaved?.();
  };

  return (
    <div
      style={{
        height: "100%",
        background: "var(--surface)",
        borderRadius: 10,
        border: "1px solid var(--border)",
        padding: 16,
        overflow: "hidden",
      }}
    >
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev",
          center: "title",
          right: "today timeGridDay timeGridWeek dayGridMonth next",
        }}
        buttonText={{ today: "오늘", month: "월", week: "주", day: "일" }}
        locale="ko"
        events={calendarEvents}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={3}
        select={handleDateSelect}
        eventClick={handleEventClick}
        height="100%"
        eventContent={(info) => {
          const calEvent = info.event.extendedProps.event as CalEvent | undefined;
          const description = calEvent?.description;

          // 멀티위크 이벤트: 첫 번째 조각에만 텍스트
          if (!info.isStart) {
            return <div className="w-full h-full" />;
          }

          return (
            <div className="px-1.5 py-0.5 overflow-hidden w-full">
              <div className="font-semibold text-xs leading-tight truncate">
                {info.event.title}{description ? ` - ${description}` : ""}
              </div>
            </div>
          );
        }}
      />

      {showModal && (
        <EventModal
          userId={userId}
          group={group}
          isLeader={isLeader}
          event={selectedEvent}
          initialDates={selectedDates}
          onSaved={handleEventSaved}
          onDeleted={handleEventDeleted}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
