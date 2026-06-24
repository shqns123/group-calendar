"use client";

import { useMemo, useState } from "react";
import { Calendar, FileText, Plus, Trash2, X } from "lucide-react";
import {
  applyDateRangeSelection,
  buildDateRangeCalendar,
  getDateRangePhaseLabel,
  shiftDateRangeMonth,
  type DateRangeSelectionPhase,
} from "@/lib/dateRange";
import { createDayNoteEntry, type DayNoteEntry } from "@/lib/dayNotes";
import { formatSeoulDateTimeLabel } from "@/lib/seoulTime";

const DATE_RANGE_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type DayNote = {
  id: string;
  date: string;
  content: string;
  items: DayNoteEntry[];
  updatedAt: string;
} | null;

type Props = {
  canEdit: boolean;
  dateKey: string;
  isSaving: boolean;
  note: DayNote;
  onClose: () => void;
  onSave: (payload: { entries: DayNoteEntry[] }) => Promise<void>;
};

function buildInitialEntries(note: DayNote, canEdit: boolean, dateKey: string) {
  if (note?.items.length) return note.items;
  return canEdit ? [createDayNoteEntry(dateKey)] : [];
}

export default function DayNoteModal({
  canEdit,
  dateKey,
  isSaving,
  note,
  onClose,
  onSave,
}: Props) {
  const initialEntries = buildInitialEntries(note, canEdit, dateKey);
  const [entries, setEntries] = useState<DayNoteEntry[]>(() => initialEntries);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRangeIndex, setActiveRangeIndex] = useState<number | null>(null);
  const [rangeSelectionPhase, setRangeSelectionPhase] = useState<DateRangeSelectionPhase>("start");
  const [rangeViewMonth, setRangeViewMonth] = useState(dateKey.slice(0, 7));

  const isEditable = canEdit && isEditing;
  const visibleEntries = isEditable ? entries : initialEntries;
  const activeEntry = activeRangeIndex == null ? null : entries[activeRangeIndex] ?? null;

  const calendarDays = useMemo(
    () =>
      buildDateRangeCalendar({
        viewMonth: rangeViewMonth,
        startDate: activeEntry?.startDate ?? dateKey,
        endDate: activeEntry?.endDate ?? dateKey,
      }),
    [activeEntry?.endDate, activeEntry?.startDate, dateKey, rangeViewMonth],
  );

  const rangeMonthLabel = useMemo(() => {
    const [year, month] = rangeViewMonth.split("-");
    return `${year}년 ${Number(month)}월`;
  }, [rangeViewMonth]);

  const updateEntry = (index: number, updates: Partial<DayNoteEntry>) => {
    setEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? createDayNoteEntry(dateKey, { ...entry, ...updates }) : entry,
      ),
    );
  };

  const addEntry = () => {
    setEntries((current) => [...current, createDayNoteEntry(dateKey)]);
  };

  const removeEntry = (index: number) => {
    setEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));
    setActiveRangeIndex((current) => {
      if (current == null) return current;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
  };

  const openRangePicker = (index: number, phase: DateRangeSelectionPhase = "start") => {
    if (!isEditable) return;

    const entry = entries[index];
    if (!entry) return;

    if (activeRangeIndex === index && phase === "start") {
      setActiveRangeIndex(null);
      return;
    }

    setActiveRangeIndex(index);
    setRangeSelectionPhase(phase);
    setRangeViewMonth((phase === "end" ? entry.endDate : entry.startDate).slice(0, 7));
  };

  const handleRangeDateChange = (value: string) => {
    if (!value || activeRangeIndex == null) return;
    const entry = entries[activeRangeIndex];
    if (!entry) return;

    const previousPhase = rangeSelectionPhase;
    const next = applyDateRangeSelection({
      currentStart: entry.startDate,
      currentEnd: entry.endDate,
      pickedDate: value,
      phase: rangeSelectionPhase,
    });

    updateEntry(activeRangeIndex, {
      startDate: next.startDate,
      endDate: next.endDate,
    });
    setRangeSelectionPhase(next.nextPhase);
    setRangeViewMonth(next.startDate.slice(0, 7));

    if (previousPhase === "start") {
      setRangeSelectionPhase("end");
      return;
    }

    setActiveRangeIndex(null);
  };

  const handleStartEditing = () => {
    setEntries(initialEntries.length > 0 ? initialEntries : [createDayNoteEntry(dateKey)]);
    setIsEditing(true);
    setError(null);
  };

  const handleCancelEditing = () => {
    setEntries(initialEntries);
    setIsEditing(false);
    setError(null);
    setActiveRangeIndex(null);
    setRangeSelectionPhase("start");
    setRangeViewMonth(dateKey.slice(0, 7));
  };

  const handleSave = async () => {
    setError(null);

    if (entries.some((entry) => entry.text.trim().length > 200)) {
      setError("각 업무내용은 200자 이하로 입력해 주세요.");
      return;
    }

    if (entries.length > 20) {
      setError("업무내용은 최대 20개까지 등록할 수 있습니다.");
      return;
    }

    try {
      await onSave({ entries });
      setIsEditing(false);
      setEntries(entries);
      setActiveRangeIndex(null);
      setRangeSelectionPhase("start");
      setRangeViewMonth(dateKey.slice(0, 7));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "업무내용 저장에 실패했습니다.");
    }
  };

  const filledCount = visibleEntries.filter((entry) => entry.text.trim().length > 0).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
        padding: 24,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-scale-in"
        style={{
          width: "100%",
          maxWidth: 500,
          background: "var(--surface)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "var(--accent-light)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileText style={{ width: 16, height: 16 }} />
            </div>
            <p
              style={{
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              업무내용
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 7,
              color: "var(--text-tertiary)",
              display: "flex",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: 20, maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleEntries.length === 0 && !canEdit && (
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  padding: "16px 18px",
                  fontSize: "0.84rem",
                  color: "var(--text-tertiary)",
                }}
              >
                등록된 업무내용이 없습니다.
              </div>
            )}

            {visibleEntries.map((entry, index) => {
              const isRangeOpen = activeRangeIndex === index;

              return (
                <div
                  key={entry.id}
                  style={{
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--surface-raised)",
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        marginTop: 10,
                        borderRadius: 999,
                        background: "var(--accent-light)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
                      <textarea
                        value={entry.text}
                        onChange={(event) => updateEntry(index, { text: event.target.value })}
                        readOnly={!isEditable}
                        placeholder={isEditable ? "업무내용을 입력해 주세요." : ""}
                        style={{
                          width: "100%",
                          minHeight: 34,
                          resize: isEditable ? "vertical" : "none",
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: isEditable ? "var(--surface)" : "var(--surface-raised)",
                          padding: "8px 12px",
                          fontFamily: "inherit",
                          fontSize: "0.84rem",
                          color: "var(--text-primary)",
                          lineHeight: 1.45,
                          outline: "none",
                        }}
                      />
                      {isEditable ? (
                        <input
                          value={entry.assignee}
                          onChange={(event) => updateEntry(index, { assignee: event.target.value })}
                          placeholder="담당자"
                          style={{
                            width: "100%",
                            height: 34,
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            padding: "0 12px",
                            fontFamily: "inherit",
                            fontSize: "0.78rem",
                            color: "var(--text-secondary)",
                            outline: "none",
                          }}
                        />
                      ) : (
                        entry.assignee && (
                          <p
                            style={{
                              marginTop: -2,
                              fontSize: "0.72rem",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            담당자 {entry.assignee}
                          </p>
                        )
                      )}

                      {isEditable && (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => openRangePicker(index, "start")}
                            title="기간 설정"
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              border: `1px solid ${isRangeOpen ? "var(--accent-muted)" : "var(--border)"}`,
                              background: isRangeOpen ? "var(--accent-light)" : "var(--surface)",
                              color: isRangeOpen ? "var(--accent)" : "#2563EB",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            <Calendar style={{ width: 15, height: 15 }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(index)}
                            title="항목 삭제"
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                              color: "var(--text-tertiary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isRangeOpen && isEditable && (
                    <div
                      style={{
                        marginTop: 10,
                        borderRadius: 12,
                        border: "1px solid var(--accent-muted)",
                        background: "color-mix(in srgb, var(--surface) 90%, var(--accent-light))",
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 12,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setRangeViewMonth((current) => shiftDateRangeMonth(current, -1))}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 999,
                            border: "1px solid var(--accent-muted)",
                            background: "var(--surface)",
                            color: "var(--accent)",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {"<"}
                        </button>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--accent-hover)" }}>
                            {rangeMonthLabel}
                          </p>
                          <p style={{ marginTop: 2, fontSize: "0.7rem", color: "var(--accent)" }}>
                            {getDateRangePhaseLabel(rangeSelectionPhase)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRangeViewMonth((current) => shiftDateRangeMonth(current, 1))}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 999,
                            border: "1px solid var(--accent-muted)",
                            background: "var(--surface)",
                            color: "var(--accent)",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {">"}
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", rowGap: 8 }}>
                        {DATE_RANGE_WEEKDAYS.map((weekday) => (
                          <div
                            key={weekday}
                            style={{
                              paddingBottom: 4,
                              textAlign: "center",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {weekday}
                          </div>
                        ))}

                        {calendarDays.map((day) => {
                          const isSingleDay = day.isRangeStart && day.isRangeEnd;

                          return (
                            <button
                              key={day.dateKey}
                              type="button"
                              onClick={() => handleRangeDateChange(day.dateKey)}
                              style={{
                                position: "relative",
                                height: 42,
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                cursor: "pointer",
                                color: day.isCurrentMonth ? "var(--text-secondary)" : "#C7CDD8",
                              }}
                            >
                              {day.isInRange && (
                                <span
                                  style={{
                                    position: "absolute",
                                    inset: "4px 0",
                                    left: isSingleDay || day.isRangeStart ? 4 : 0,
                                    right: isSingleDay || day.isRangeEnd ? 4 : 0,
                                    borderTopLeftRadius: isSingleDay || day.isRangeStart ? 999 : 0,
                                    borderBottomLeftRadius: isSingleDay || day.isRangeStart ? 999 : 0,
                                    borderTopRightRadius: isSingleDay || day.isRangeEnd ? 999 : 0,
                                    borderBottomRightRadius: isSingleDay || day.isRangeEnd ? 999 : 0,
                                    background: "var(--accent-light)",
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  position: "relative",
                                  zIndex: 1,
                                  display: "inline-flex",
                                  width: 34,
                                  height: 34,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: 999,
                                  background: day.isRangeStart || day.isRangeEnd ? "var(--accent)" : "transparent",
                                  color: day.isRangeStart || day.isRangeEnd ? "#fff" : undefined,
                                  fontSize: "0.82rem",
                                  fontWeight: day.isRangeStart || day.isRangeEnd ? 700 : 500,
                                }}
                              >
                                {day.dayOfMonth}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isEditable && (
            <button
              type="button"
              onClick={addEntry}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px dashed var(--border)",
                background: "var(--surface)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.8rem",
                fontWeight: 700,
              }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              업무내용 추가
            </button>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              gap: 12,
            }}
          >
            <div style={{ fontSize: "0.72rem", color: error ? "#DC2626" : "var(--text-tertiary)" }}>
              {error ??
                (isEditable
                  ? `${filledCount}개 항목`
                  : note?.updatedAt
                    ? "등록된 업무내용 목록입니다."
                    : "아직 등록된 업무내용이 없습니다.")}
            </div>
            {note?.updatedAt && (
              <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", flexShrink: 0 }}>
                최근 수정 {formatSeoulDateTimeLabel(note.updatedAt)}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: "14px 20px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={isEditable ? handleCancelEditing : onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 9,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            {isEditable ? "취소" : "닫기"}
          </button>

          {canEdit && !isEditable && (
            <button
              type="button"
              onClick={handleStartEditing}
              style={{
                padding: "8px 14px",
                borderRadius: 9,
                border: "1px solid var(--accent-muted)",
                background: "var(--surface)",
                color: "var(--accent)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.8rem",
                fontWeight: 700,
              }}
            >
              수정
            </button>
          )}

          {isEditable && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: "8px 14px",
                borderRadius: 9,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                cursor: isSaving ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                fontSize: "0.8rem",
                fontWeight: 700,
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
