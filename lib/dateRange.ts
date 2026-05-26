export type DateRangeSelectionPhase = "start" | "end";

type ApplyDateRangeSelectionInput = {
  currentStart: string;
  currentEnd: string;
  pickedDate: string;
  phase: DateRangeSelectionPhase;
};

export function formatDateRangeLabel(startDate: string, endDate: string) {
  if (!startDate) return "";
  if (!endDate || startDate === endDate) return startDate;
  return `${startDate} ~ ${endDate}`;
}

export function applyDateRangeSelection({
  currentStart,
  currentEnd,
  pickedDate,
  phase,
}: ApplyDateRangeSelectionInput) {
  if (phase === "start" || !currentStart) {
    return {
      startDate: pickedDate,
      endDate: pickedDate,
      nextPhase: "end" as const,
    };
  }

  if (pickedDate < currentStart) {
    return {
      startDate: pickedDate,
      endDate: currentStart || currentEnd || pickedDate,
      nextPhase: "start" as const,
    };
  }

  return {
    startDate: currentStart,
    endDate: pickedDate,
    nextPhase: "start" as const,
  };
}
