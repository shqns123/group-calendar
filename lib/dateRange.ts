export type DateRangeSelectionPhase = "start" | "end";
export type DateRangeCalendarDay = {
  dateKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

type ApplyDateRangeSelectionInput = {
  currentStart: string;
  currentEnd: string;
  pickedDate: string;
  phase: DateRangeSelectionPhase;
};

type BuildDateRangeCalendarInput = {
  viewMonth: string;
  startDate: string;
  endDate: string;
};

function padMonthOrDay(value: number) {
  return String(value).padStart(2, "0");
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

function toMonthKey(year: number, monthIndex: number) {
  return `${year}-${padMonthOrDay(monthIndex + 1)}`;
}

function toDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${padMonthOrDay(monthIndex + 1)}-${padMonthOrDay(day)}`;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function formatDateRangeLabel(startDate: string, endDate: string) {
  const formatShortDate = (value: string) => value.slice(2).replaceAll("-", ".");

  if (!startDate) return "";
  if (!endDate || startDate === endDate) return formatShortDate(startDate);
  return `${formatShortDate(startDate)} ~ ${formatShortDate(endDate)}`;
}

export function getDateRangePhaseLabel(phase: DateRangeSelectionPhase) {
  return phase === "start" ? "시작일 선택 중" : "종료일 선택 중";
}

export function shiftDateRangeMonth(viewMonth: string, delta: number) {
  const { year, monthIndex } = parseMonthKey(viewMonth);
  const shifted = new Date(year, monthIndex + delta, 1);
  return toMonthKey(shifted.getFullYear(), shifted.getMonth());
}

export function buildDateRangeCalendar({
  viewMonth,
  startDate,
  endDate,
}: BuildDateRangeCalendarInput): DateRangeCalendarDay[] {
  const { year, monthIndex } = parseMonthKey(viewMonth);
  const firstDay = new Date(year, monthIndex, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const daysInPreviousMonth = getDaysInMonth(year, monthIndex - 1);
  const cells: DateRangeCalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    let cellYear = year;
    let cellMonthIndex = monthIndex;
    let dayOfMonth = index - firstWeekday + 1;
    let isCurrentMonth = true;

    if (dayOfMonth <= 0) {
      const previousMonth = new Date(year, monthIndex - 1, 1);
      cellYear = previousMonth.getFullYear();
      cellMonthIndex = previousMonth.getMonth();
      dayOfMonth = daysInPreviousMonth + dayOfMonth;
      isCurrentMonth = false;
    } else if (dayOfMonth > daysInMonth) {
      const nextMonth = new Date(year, monthIndex + 1, 1);
      cellYear = nextMonth.getFullYear();
      cellMonthIndex = nextMonth.getMonth();
      dayOfMonth -= daysInMonth;
      isCurrentMonth = false;
    }

    const dateKey = toDateKey(cellYear, cellMonthIndex, dayOfMonth);
    cells.push({
      dateKey,
      dayOfMonth,
      isCurrentMonth,
      isInRange: dateKey >= startDate && dateKey <= endDate,
      isRangeStart: dateKey === startDate,
      isRangeEnd: dateKey === endDate,
    });
  }

  return cells;
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
