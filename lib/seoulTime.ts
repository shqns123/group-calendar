const SEOUL_OFFSET_HOURS = 9;
const SEOUL_OFFSET_MS = SEOUL_OFFSET_HOURS * 60 * 60 * 1000;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_WITHOUT_ZONE_RE =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(\.\d{1,3})?)?$/;

export const SEOUL_TIME_ZONE = "Asia/Seoul";

type DateLike = Date | string | number;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDate(value: DateLike) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function toSeoulShiftedDate(value: DateLike) {
  return new Date(toDate(value).getTime() + SEOUL_OFFSET_MS);
}

function extractSeoulParts(value: DateLike) {
  const shifted = toSeoulShiftedDate(value);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

function buildSeoulDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, -SEOUL_OFFSET_HOURS, 0, 0, 0));
}

export function parseSeoulDateInput(value: string) {
  const match = value.match(DATE_ONLY_RE);
  if (!match) {
    throw new Error(`Invalid Seoul date input: ${value}`);
  }

  const [, year, month, day] = match;
  return buildSeoulDate(Number(year), Number(month), Number(day));
}

export function parseEventDateInput(value: string) {
  const dateOnlyMatch = value.match(DATE_ONLY_RE);
  if (dateOnlyMatch) {
    return parseSeoulDateInput(value);
  }

  const datetimeMatch = value.match(DATE_TIME_WITHOUT_ZONE_RE);
  if (datetimeMatch) {
    const [, datePart, timePart, seconds = "00", fraction = ""] = datetimeMatch;
    return new Date(`${datePart}T${timePart}:${seconds}${fraction}+09:00`);
  }

  return new Date(value);
}

export function formatSeoulDateKey(value: DateLike) {
  const { year, month, day } = extractSeoulParts(value);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatSeoulMonthDayKey(value: DateLike) {
  const { month, day } = extractSeoulParts(value);
  return `${pad(month)}-${pad(day)}`;
}

export function toSeoulDateInput(value: DateLike) {
  return formatSeoulDateKey(value);
}

export function addSeoulDays(value: DateLike, days: number) {
  const { year, month, day } = extractSeoulParts(value);
  return new Date(Date.UTC(year, month - 1, day + days, -SEOUL_OFFSET_HOURS, 0, 0, 0));
}

export function getSeoulDayRange(value: DateLike) {
  const start =
    typeof value === "string" && DATE_ONLY_RE.test(value)
      ? parseSeoulDateInput(value)
      : addSeoulDays(value, 0);

  return {
    start,
    end: new Date(addSeoulDays(start, 1).getTime() - 1),
  };
}

export function isSameSeoulDate(left: DateLike, right: DateLike) {
  return formatSeoulDateKey(left) === formatSeoulDateKey(right);
}

export function compareSeoulDateKeys(left: DateLike, right: DateLike) {
  return formatSeoulDateKey(left).localeCompare(formatSeoulDateKey(right));
}

export function getSeoulWeekday(value: DateLike) {
  return extractSeoulParts(value).weekday;
}

export function formatSeoulYearMonthLabel(value: DateLike) {
  const { year, month } = extractSeoulParts(value);
  return `${year}년 ${month}월`;
}

export function formatSeoulMonthDayWeekdayLabel(value: DateLike) {
  const { month, day } = extractSeoulParts(value);
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    weekday: "short",
  }).format(toDate(value));

  return `${month}월 ${day}일 (${weekday})`;
}

export function formatSeoulSlashMonthDayLabel(value: DateLike) {
  const { month, day } = extractSeoulParts(value);
  return `${pad(month)}/${pad(day)}`;
}

export function formatSeoulSlashMonthDayWeekdayLabel(value: DateLike) {
  const { month, day } = extractSeoulParts(value);
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    weekday: "short",
  }).format(toDate(value));

  return `${pad(month)}/${pad(day)} (${weekday})`;
}

export function formatSeoulTimeLabel(value: DateLike) {
  const { hours, minutes } = extractSeoulParts(value);
  return `${pad(hours)}:${pad(minutes)}`;
}

export function formatSeoulSlashMonthDayTimeLabel(value: DateLike) {
  return `${formatSeoulSlashMonthDayLabel(value)} ${formatSeoulTimeLabel(value)}`;
}

export function formatSeoulDateTimeLabel(value: DateLike, locale = "ko-KR") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(toDate(value));
}
