type EventDateShape = {
  startDate: string;
  endDate: string;
  allDay: boolean;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function extractDateKey(value: string): string | null {
  const trimmed = value.trim();
  const dateKey = DATE_ONLY_PATTERN.test(trimmed) ? trimmed : trimmed.slice(0, 10);
  if (!DATE_ONLY_PATTERN.test(dateKey)) {
    return null;
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  if (!isValidDateParts(year, month, day)) {
    return null;
  }

  return dateKey;
}

export function parseDateKeyAsLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKeyAsLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

export function parseApiEventDate(value: string, allDay: boolean): Date | null {
  if (allDay) {
    const dateKey = extractDateKey(value);
    return dateKey ? new Date(`${dateKey}T00:00:00.000Z`) : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseEventDate(value: string, allDay: boolean): Date {
  if (allDay) {
    const dateKey = extractDateKey(value);
    if (dateKey) {
      return parseDateKeyAsLocalDate(dateKey);
    }
  }

  return new Date(value);
}

export function getEventStartDate(event: EventDateShape): Date {
  return parseEventDate(event.startDate, event.allDay);
}

export function getEventEndDate(event: EventDateShape): Date {
  return parseEventDate(event.endDate, event.allDay);
}

export function getEventStartDateKey(event: EventDateShape): string {
  return extractDateKey(event.startDate) ?? formatDateKey(getEventStartDate(event));
}

export function getEventEndDateKey(event: EventDateShape): string {
  return extractDateKey(event.endDate) ?? formatDateKey(getEventEndDate(event));
}

export function getCalendarEventStart(event: EventDateShape): string | Date {
  return event.allDay ? getEventStartDateKey(event) : new Date(event.startDate);
}

export function getCalendarEventEnd(event: EventDateShape): string | Date {
  if (event.allDay) {
    return addDaysToDateKey(getEventEndDateKey(event), 1);
  }

  return new Date(event.endDate);
}

export function isEventOnDate(event: EventDateShape, date: Date): boolean {
  if (event.allDay) {
    const targetKey = formatDateKey(date);
    return getEventStartDateKey(event) <= targetKey && getEventEndDateKey(event) >= targetKey;
  }

  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

export function compareEventsByStart(a: EventDateShape, b: EventDateShape): number {
  return getEventStartDate(a).getTime() - getEventStartDate(b).getTime();
}

export function parseRangeStartParam(value: string): Date | null {
  if (DATE_ONLY_PATTERN.test(value.trim())) {
    return new Date(`${value.trim()}T00:00:00.000Z`);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseRangeEndParam(value: string): Date | null {
  if (DATE_ONLY_PATTERN.test(value.trim())) {
    return new Date(`${value.trim()}T23:59:59.999Z`);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
