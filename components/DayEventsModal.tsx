"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, Plus, X } from "lucide-react";
import DayNoteModal from "./DayNoteModal";
import EquipmentStatusIcon from "./EquipmentStatusIcon";
import EquipmentStockModal from "./EquipmentStockModal";
import PersonnelAvailabilityIcon from "./PersonnelAvailabilityIcon";
import PersonnelAvailabilityModal from "./PersonnelAvailabilityModal";
import { getEquipmentStock } from "./equipmentStock";
import { getPersonnelAvailability } from "./personnelAvailability";
import {
  formatSeoulDateKey,
  formatSeoulMonthDayKey,
  formatSeoulMonthDayWeekdayLabel,
  formatSeoulSlashMonthDayLabel,
  formatSeoulTimeLabel,
  isSameSeoulDate,
  parseSeoulDateInput,
} from "@/lib/seoulTime";

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

function getHolidayName(date: Date): string | null {
  return FIXED_HOLIDAYS[formatSeoulMonthDayKey(date)] || LUNAR_HOLIDAYS[formatSeoulDateKey(date)] || null;
}

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
    status?: string | null;
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
  isOperator: boolean;
  isObserver: boolean;
  customHolidays?: CustomHoliday[];
  onEventClick: (event: CalEvent) => void;
  onAddClick: () => void;
  onClose: () => void;
  onRefresh: () => void;
};

type DayNote = {
  id: string;
  date: string;
  content: string;
  items: Array<{
    id: string;
    text: string;
    startDate: string;
    endDate: string;
  }>;
  updatedAt: string;
} | null;

export default function DayEventsModal({
  date,
  events,
  userId,
  group,
  isLeader,
  isOperator,
  isObserver,
  customHolidays = [],
  onEventClick,
  onAddClick,
  onClose,
  onRefresh,
}: Props) {
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<"available" | "unavailable" | null | undefined>(undefined);
  const [showEquipmentStockModal, setShowEquipmentStockModal] = useState(false);
  const [showPersonnelAvailabilityModal, setShowPersonnelAvailabilityModal] = useState(false);
  const [showDayNoteModal, setShowDayNoteModal] = useState(false);
  const [dayNote, setDayNote] = useState<DayNote>(null);
  const [dayNoteCanEdit, setDayNoteCanEdit] = useState(false);
  const [dayNoteLoading, setDayNoteLoading] = useState(false);
  const [dayNoteSaving, setDayNoteSaving] = useState(false);
  const [isDayNoteExpanded, setIsDayNoteExpanded] = useState(false);

  const getMemberName = (event: CalEvent) => {
    if (!group) return event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
    const member = group.members.find((memberItem) => memberItem.userId === event.creatorId);
    return member?.nickname || event.creator.name || event.creator.email?.split("@")[0] || "알 수 없음";
  };

  const myOvertimeEvent = events.find(
    (event) => event.isOvertimeOnly && event.creatorId === userId && isSameSeoulDate(event.startDate, date),
  );

  const overtimeStatus: "available" | "unavailable" | null = myOvertimeEvent
    ? myOvertimeEvent.overtimeAvailable
      ? "available"
      : "unavailable"
    : null;

  useEffect(() => {
    setLocalStatus(undefined);
  }, [events]);

  const effectiveStatus = localStatus !== undefined ? localStatus : overtimeStatus;

  const handleOvertimeSelect = async (choice: "available" | "unavailable") => {
    if (overtimeLoading) return;

    setOvertimeLoading(true);
    const isSameChoice = Boolean(
      myOvertimeEvent &&
        ((choice === "available" && myOvertimeEvent.overtimeAvailable) ||
          (choice === "unavailable" && !myOvertimeEvent.overtimeAvailable)),
    );
    setLocalStatus(isSameChoice ? null : choice);

    try {
      if (myOvertimeEvent) {
        const deleteResponse = await fetch(`/api/events/${myOvertimeEvent.id}`, { method: "DELETE" });
        if (!deleteResponse.ok) throw new Error("delete failed");
      }

      if (!isSameChoice) {
        const dateStr = formatSeoulDateKey(date);
        const createResponse = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: choice === "available" ? "특근 가능" : "특근 불가능",
            startDate: parseSeoulDateInput(dateStr).toISOString(),
            endDate: parseSeoulDateInput(dateStr).toISOString(),
            allDay: true,
            color: choice === "available" ? "#F59E0B" : "#EF4444",
            overtimeAvailable: choice === "available",
            isOvertimeOnly: true,
            groupId: group?.id ?? null,
          }),
        });
        if (!createResponse.ok) throw new Error("create failed");
      }

      onRefresh();
    } catch {
      setLocalStatus(undefined);
    } finally {
      setOvertimeLoading(false);
    }
  };

  const overtimePeopleAvailable = events.filter(
    (event) => event.isOvertimeOnly && event.creatorId !== userId && event.overtimeAvailable,
  );
  const overtimePeopleUnavailable = events.filter(
    (event) => event.isOvertimeOnly && event.creatorId !== userId && !event.overtimeAvailable,
  );

  const normalEvents = events.filter((event) => !event.isOvertimeOnly);
  const sorted = [...normalEvents].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const equipmentStock = useMemo(() => getEquipmentStock(group, normalEvents), [group, normalEvents]);
  const personnelAvailability = useMemo(
    () => getPersonnelAvailability(group, normalEvents),
    [group, normalEvents],
  );

  const dateStr = formatSeoulDateKey(date);
  const customEntry = customHolidays.find((holiday) => holiday.date === dateStr);
  const holidayName =
    customEntry?.type === "workday" ? "대체 근무일" : customEntry?.name ?? getHolidayName(date);
  const dayNoteItems = dayNote?.items ?? [];
  const hasDayNote = dayNoteItems.length > 0;
  const visibleDayNoteItems = isDayNoteExpanded ? dayNoteItems : dayNoteItems.slice(0, 1);
  const hiddenDayNoteCount = Math.max(dayNoteItems.length - visibleDayNoteItems.length, 0);

  useEffect(() => {
    setIsDayNoteExpanded(false);
  }, [dateStr, group?.id]);

  useEffect(() => {
    if (!group) {
      setDayNote(null);
      setDayNoteCanEdit(false);
      return;
    }

    let cancelled = false;
    setDayNoteLoading(true);

    void fetch(`/api/day-notes?groupId=${group.id}&date=${dateStr}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("업무내용을 불러오지 못했습니다.");
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setDayNote(data.note ?? null);
        setDayNoteCanEdit(Boolean(data.canEdit));
      })
      .catch(() => {
        if (cancelled) return;
        setDayNote(null);
        setDayNoteCanEdit(Boolean(isLeader || isOperator));
      })
      .finally(() => {
        if (!cancelled) setDayNoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateStr, group, isLeader, isOperator]);

  const saveDayNote = async ({
    entries,
  }: {
    entries: Array<{
      id: string;
      text: string;
      startDate: string;
      endDate: string;
    }>;
  }) => {
    if (!group) return;

    setDayNoteSaving(true);
    try {
      const response = await fetch("/api/day-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.id,
          date: dateStr,
          entries,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "업무내용 저장에 실패했습니다.");
      }

      setDayNote(data?.note ?? null);
      setDayNoteCanEdit(Boolean(data?.canEdit));
    } finally {
      setDayNoteSaving(false);
    }
  };

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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
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
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <p
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.02em",
                }}
              >
                {formatSeoulMonthDayWeekdayLabel(date)}
              </p>
              {holidayName && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: customEntry?.type === "workday" ? "var(--accent)" : "#EF4444",
                  }}
                >
                  {holidayName}
                </span>
              )}
              {group && equipmentStock?.hasConfiguredEquipment && (
                <button
                  type="button"
                  onClick={() => setShowEquipmentStockModal(true)}
                  title="장비 잔여량"
                  style={{
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
            </div>
            <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 2 }}>
              {sorted.length === 0 ? "일정 없음" : `${sorted.length}개 일정`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 7,
              color: "var(--text-tertiary)",
              display: "flex",
              transition: "background 0.1s",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = "var(--surface-raised)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "none";
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {group && (
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
              background:
                effectiveStatus === "available"
                  ? "var(--accent-light)"
                  : effectiveStatus === "unavailable"
                    ? "rgba(239,68,68,0.07)"
                    : "var(--surface-raised)",
              transition: "background 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background:
                      effectiveStatus === "available"
                        ? "var(--accent-muted)"
                        : effectiveStatus === "unavailable"
                          ? "rgba(239,68,68,0.15)"
                          : "var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <CalendarClock
                    style={{
                      width: 14,
                      height: 14,
                      color:
                        effectiveStatus === "available"
                          ? "var(--accent)"
                          : effectiveStatus === "unavailable"
                            ? "#EF4444"
                            : "var(--text-tertiary)",
                    }}
                  />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "0.825rem",
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      color:
                        effectiveStatus === "available"
                          ? "var(--accent-hover)"
                          : effectiveStatus === "unavailable"
                            ? "#EF4444"
                            : "var(--text-primary)",
                    }}
                  >
                    특근
                  </p>
                </div>
              </div>
              {!isObserver && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleOvertimeSelect("unavailable")}
                    disabled={overtimeLoading}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontFamily: "inherit",
                      border: `1.5px solid ${effectiveStatus === "unavailable" ? "#EF4444" : "var(--border)"}`,
                      background: effectiveStatus === "unavailable" ? "#EF4444" : "transparent",
                      color: effectiveStatus === "unavailable" ? "#fff" : "var(--text-secondary)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: overtimeLoading ? "not-allowed" : "pointer",
                      transition: "all 0.18s",
                      opacity: overtimeLoading ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {effectiveStatus === "unavailable" && (
                      <span style={{ fontSize: "0.65rem", lineHeight: 1 }}>✓</span>
                    )}
                    불가능
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOvertimeSelect("available")}
                    disabled={overtimeLoading}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontFamily: "inherit",
                      border: `1.5px solid ${effectiveStatus === "available" ? "var(--accent)" : "var(--border)"}`,
                      background: effectiveStatus === "available" ? "var(--accent)" : "transparent",
                      color: effectiveStatus === "available" ? "#fff" : "var(--text-secondary)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: overtimeLoading ? "not-allowed" : "pointer",
                      transition: "all 0.18s",
                      opacity: overtimeLoading ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {effectiveStatus === "available" && (
                      <span style={{ fontSize: "0.65rem", lineHeight: 1 }}>✓</span>
                    )}
                    가능
                  </button>
                </div>
              )}
            </div>

            {(overtimePeopleAvailable.length > 0 ||
              effectiveStatus === "available" ||
              (isLeader && (overtimePeopleUnavailable.length > 0 || effectiveStatus === "unavailable"))) && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {(overtimePeopleAvailable.length > 0 || effectiveStatus === "available") && (
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", columnGap: 6 }}>
                    <div
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        color: "var(--accent)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      가능:
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {overtimePeopleAvailable.map((event) => (
                        <span
                          key={event.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.68rem",
                            background: "var(--accent-light)",
                            color: "var(--accent)",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontWeight: 600,
                            border: "1px solid var(--accent-muted)",
                          }}
                        >
                          {getMemberName(event)}
                          {isLeader && (
                            <button
                              onClick={async (clickEvent) => {
                                clickEvent.stopPropagation();
                                await fetch(`/api/events/${event.id}`, { method: "DELETE" });
                                onRefresh();
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                display: "flex",
                                color: "var(--accent)",
                                lineHeight: 1,
                              }}
                            >
                              <X style={{ width: 10, height: 10 }} />
                            </button>
                          )}
                        </span>
                      ))}
                      {effectiveStatus === "available" && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            background: "var(--accent)",
                            color: "#fff",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontWeight: 600,
                          }}
                        >
                          나
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {isLeader && (overtimePeopleUnavailable.length > 0 || effectiveStatus === "unavailable") && (
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", columnGap: 6 }}>
                    <div
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        color: "#EF4444",
                        whiteSpace: "nowrap",
                      }}
                    >
                      불가능:
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {overtimePeopleUnavailable.map((event) => (
                        <span
                          key={event.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.68rem",
                            background: "rgba(239,68,68,0.1)",
                            color: "#EF4444",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontWeight: 600,
                            border: "1px solid rgba(239,68,68,0.2)",
                          }}
                        >
                          {getMemberName(event)}
                          <button
                            onClick={async (clickEvent) => {
                              clickEvent.stopPropagation();
                              await fetch(`/api/events/${event.id}`, { method: "DELETE" });
                              onRefresh();
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              display: "flex",
                              color: "#EF4444",
                              lineHeight: 1,
                            }}
                          >
                            <X style={{ width: 10, height: 10 }} />
                          </button>
                        </span>
                      ))}
                      {effectiveStatus === "unavailable" && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            background: "#EF4444",
                            color: "#fff",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontWeight: 600,
                          }}
                        >
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

        {group && (
          <div
            style={{
              padding: "14px 20px 12px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <p
                style={{
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                }}
              >
                업무내용
              </p>
              {dayNoteCanEdit && (
                <button
                  type="button"
                  onClick={() => setShowDayNoteModal(true)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--accent-muted)",
                    background: "var(--surface)",
                    color: "var(--accent)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                    opacity: dayNoteLoading ? 0.7 : 1,
                  }}
                >
                  수정
                </button>
              )}
            </div>

            {hasDayNote && (
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
                  cursor: "pointer",
                  textAlign: "left",
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
                      border: "1px solid var(--border)",
                      background: "var(--surface-raised)",
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
                    <p
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.text}
                    </p>
                  </div>
                ))}

                {(hiddenDayNoteCount > 0 || dayNoteItems.length > 1) && (
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
            )}
          </div>
        )}

        <div
          style={{
            padding: "12px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-tertiary)" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </div>
              <p style={{ fontSize: "0.875rem" }}>이 날 일정이 없습니다</p>
            </div>
          ) : (
            sorted.map((event, index) => {
              const start = new Date(event.startDate);
              const end = new Date(event.endDate);
              const creatorName = event.personnel || getMemberName(event);

              return (
                <button
                  key={event.id}
                  className="stagger-item"
                  onClick={() => onEventClick(event)}
                  style={{
                    animationDelay: `${index * 28}ms`,
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
                  onMouseEnter={(mouseEvent) => {
                    mouseEvent.currentTarget.style.background = "var(--surface-hover)";
                  }}
                  onMouseLeave={(mouseEvent) => {
                    mouseEvent.currentTarget.style.background = "var(--surface-raised)";
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      borderRadius: 4,
                      flexShrink: 0,
                      background: event.color,
                      alignSelf: "stretch",
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          letterSpacing: "-0.01em",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {event.title}
                      </p>
                      {(isLeader || event.creatorId === userId) && event.overtimeAvailable && (
                        <span
                          style={{
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: "var(--accent-light)",
                            color: "var(--accent)",
                            flexShrink: 0,
                          }}
                        >
                          특근
                        </span>
                      )}
                    </div>

                    {event.allDay && !isSameSeoulDate(start, end) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                        <Clock style={{ width: 11, height: 11, color: "var(--text-tertiary)", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {`${formatSeoulSlashMonthDayLabel(start)} – ${formatSeoulSlashMonthDayLabel(end)}`}
                        </span>
                      </div>
                    )}
                    {!event.allDay && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                        <Clock style={{ width: 11, height: 11, color: "var(--text-tertiary)", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {`${formatSeoulTimeLabel(start)} – ${formatSeoulTimeLabel(end)}`}
                        </span>
                      </div>
                    )}
                    {event.description && (
                      <p
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-tertiary)",
                          marginTop: 3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {event.description}
                      </p>
                    )}

                    {group && (
                      <div style={{ marginTop: 6 }}>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            background: `${event.color}20`,
                            color: event.color,
                            padding: "2px 8px",
                            borderRadius: 10,
                          }}
                        >
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

        {group && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!isObserver && (
                <button
                  onClick={onAddClick}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 9,
                    border: "1.5px dashed var(--border)",
                    background: "none",
                    color: "var(--text-tertiary)",
                    fontSize: "0.825rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.borderColor = "var(--accent)";
                    event.currentTarget.style.color = "var(--accent)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.borderColor = "var(--border)";
                    event.currentTarget.style.color = "var(--text-tertiary)";
                  }}
                >
                  <Plus style={{ width: 14, height: 14 }} />
                  일정 추가
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showEquipmentStockModal && equipmentStock && (
        <EquipmentStockModal
          stock={equipmentStock}
          title="장비 현황"
          subtitle={`${formatSeoulMonthDayWeekdayLabel(date)} 일정 기준`}
          onClose={() => setShowEquipmentStockModal(false)}
        />
      )}
      {showPersonnelAvailabilityModal && personnelAvailability && (
        <PersonnelAvailabilityModal
          availability={personnelAvailability}
          title="인원 현황"
          subtitle={`${formatSeoulMonthDayWeekdayLabel(date)} 일정 기준`}
          onClose={() => setShowPersonnelAvailabilityModal(false)}
        />
      )}
      {showDayNoteModal && group && (
        <DayNoteModal
          key={dayNote?.id ?? `${group.id}-${dateStr}-${dayNote?.updatedAt ?? "empty"}`}
          canEdit={dayNoteCanEdit}
          dateKey={dateStr}
          isSaving={dayNoteSaving}
          note={dayNote}
          onClose={() => setShowDayNoteModal(false)}
          onSave={saveDayNote}
        />
      )}
    </div>
  );
}
