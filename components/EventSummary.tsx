"use client";

import { useCallback, useEffect, useState } from "react";
import { isPast } from "date-fns";
import { Clock, MapPin, PanelLeftClose, RefreshCw } from "lucide-react";
import {
  addSeoulDays,
  formatSeoulDateKey,
  formatSeoulSlashMonthDayLabel,
  formatSeoulSlashMonthDayTimeLabel,
  formatSeoulSlashMonthDayWeekdayLabel,
  formatSeoulTimeLabel,
  getSeoulDayRange,
  isSameSeoulDate,
} from "@/lib/seoulTime";

type CalEvent = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string;
  overtimeAvailable: boolean;
  isOvertimeOnly: boolean;
  equipmentOnly?: boolean;
  personnel: string | null;
  equipment?: string | null;
  creatorId: string;
  groupId: string | null;
  creatorNickname?: string | null;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
};

type Group = {
  id: string;
  name: string;
  leaderId: string;
  trackerOptions?: string | null;
  laptopOptions?: string | null;
  targetCount?: number;
  members: Array<{
    id: string;
    userId: string;
    nickname: string | null;
    role: string;
    user: { id: string; name: string | null; email: string | null; image: string | null };
  }>;
};

type Props = {
  userId: string;
  group: Group | null;
  isLeader: boolean;
  onEventClick: (event: CalEvent) => void;
  refreshKey: number;
  onClose: () => void;
};

type GroupedEvents = {
  label: string;
  accent: string;
  events: CalEvent[];
};

function getDateLabel(date: Date): string {
  const todayStart = getSeoulDayRange(new Date()).start;
  const eventStart = getSeoulDayRange(date).start;
  const diffDays = Math.round((eventStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "내일";
  if (diffDays >= 2 && diffDays <= 6) return "이번 주";
  if (formatSeoulDateKey(date).slice(0, 7) === formatSeoulDateKey(todayStart).slice(0, 7) && diffDays > 6) {
    return "이번 달";
  }
  if (diffDays > 31) return "다음 달 이후";

  return `${Number(formatSeoulDateKey(date).slice(5, 7))}월`;
}

export default function EventSummary({
  group,
  onEventClick,
  refreshKey,
  onClose,
}: Props) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const todayRange = getSeoulDayRange(new Date());
      const futureRange = getSeoulDayRange(addSeoulDays(todayRange.start, 365));

      const params = new URLSearchParams({
        start: todayRange.start.toISOString(),
        end: futureRange.end.toISOString(),
      });
      if (group) params.set("groupId", group.id);

      const res = await fetch(`/api/events?${params}`);
      if (res.ok) {
        const data: CalEvent[] = await res.json();
        data.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setEvents(data);
      }
    } catch {
      // Keep the panel mounted even if the local API temporarily fails during schema changes.
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents, refreshKey]);

  const grouped: GroupedEvents[] = [];
  const labelMap = new Map<string, CalEvent[]>();
  const labelOrder: string[] = [];

  for (const event of events.filter((item) => !item.isOvertimeOnly)) {
    const label = getDateLabel(new Date(event.startDate));
    if (!labelMap.has(label)) {
      labelMap.set(label, []);
      labelOrder.push(label);
    }
    labelMap.get(label)!.push(event);
  }

  const labelAccents: Record<string, string> = {
    "오늘": "var(--accent)",
    "내일": "#6366F1",
    "이번 주": "#8B5CF6",
    "이번 달": "var(--text-secondary)",
    "다음 달 이후": "var(--text-tertiary)",
  };

  for (const label of labelOrder) {
    grouped.push({
      label,
      accent: labelAccents[label] ?? "var(--text-tertiary)",
      events: labelMap.get(label)!,
    });
  }

  const getCreatorName = (event: CalEvent) => {
    if (!group) return null;
    const member = group.members.find((memberItem) => memberItem.userId === event.creatorId);
    return member?.nickname || event.creator.name || event.creator.email?.split("@")[0];
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            일정 요약
          </h3>
          <p style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", marginTop: 1 }}>
            이후 일정 총 {events.filter((item) => !item.isOvertimeOnly).length}건
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            onClick={() => void fetchEvents()}
            disabled={loading}
            title="새로고침"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
              color: "var(--text-tertiary)",
              display: "flex",
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
          >
            <RefreshCw
              style={{
                width: 13,
                height: 13,
                ...(loading ? { animation: "spin 1s linear infinite" } : {}),
              }}
            />
          </button>
          <button
            onClick={onClose}
            title="일정 요약 닫기"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
              color: "var(--text-tertiary)",
              display: "flex",
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
          >
            <PanelLeftClose style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {events.length === 0 && !loading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: 160,
              color: "var(--text-tertiary)",
            }}
          >
            <Clock style={{ width: 32, height: 32, marginBottom: 8, opacity: 0.4 }} />
            <p style={{ fontSize: "0.825rem" }}>표시할 일정이 없습니다</p>
          </div>
        )}

        {grouped.map((groupedItem, groupedIndex) => (
          <div key={groupedItem.label}>
            <div
              style={{
                position: "sticky",
                top: 0,
                background: "var(--surface-raised)",
                padding: "6px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: groupedItem.accent,
                }}
              >
                {groupedItem.label}
              </span>
              <span style={{ fontSize: "0.62rem", color: "var(--text-tertiary)" }}>
                ({groupedItem.events.length})
              </span>
            </div>

            {groupedItem.events.map((event, eventIndex) => {
              const creatorName = getCreatorName(event);
              const summaryLabel = event.equipmentOnly
                ? event.equipment || "장비 반출"
                : event.personnel || creatorName;
              const start = new Date(event.startDate);
              const end = new Date(event.endDate);
              const isPastEvent = isPast(end) && !isSameSeoulDate(end, new Date());

              return (
                <button
                  key={event.id}
                  className="stagger-item"
                  onClick={() => onEventClick(event)}
                  style={{
                    animationDelay: `${(groupedIndex * 3 + eventIndex) * 30}ms`,
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
                    background: "none",
                    border: "none",
                    borderBottomWidth: 1,
                    borderBottomStyle: "solid",
                    borderBottomColor: "var(--border-subtle)",
                    cursor: "pointer",
                    opacity: isPastEvent ? 0.5 : 1,
                    fontFamily: "inherit",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        flexShrink: 0,
                        marginTop: 4,
                        backgroundColor: event.color,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span
                          style={{
                            fontSize: "0.825rem",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {event.title}
                        </span>
                      </div>

                      {event.description && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <MapPin
                            style={{
                              width: 10,
                              height: 10,
                              color: "var(--text-tertiary)",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--text-secondary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {event.description}
                          </span>
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                        <Clock
                          style={{
                            width: 10,
                            height: 10,
                            color: "var(--text-tertiary)",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                          {event.allDay
                            ? isSameSeoulDate(start, end)
                              ? formatSeoulSlashMonthDayWeekdayLabel(start)
                              : `${formatSeoulSlashMonthDayLabel(start)} ~ ${formatSeoulSlashMonthDayLabel(end)}`
                            : isSameSeoulDate(start, end)
                              ? `${formatSeoulSlashMonthDayTimeLabel(start)} ~ ${formatSeoulTimeLabel(end)}`
                              : `${formatSeoulSlashMonthDayTimeLabel(start)} ~ ${formatSeoulSlashMonthDayTimeLabel(end)}`}
                        </span>
                      </div>

                      {summaryLabel && (
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              background: event.equipmentOnly ? "#EEF2FF" : event.color + "20",
                              color: event.equipmentOnly ? "#4F46E5" : event.color,
                              padding: "2px 8px",
                              borderRadius: 10,
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {summaryLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
