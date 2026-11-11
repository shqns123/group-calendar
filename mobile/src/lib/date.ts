// Date helpers. The server stores all-day events at Asia/Seoul midnight and
// compares by Seoul date keys ("yyyy-MM-dd"); everything here follows that.

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
export const WEEKDAYS_LONG = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const;

export type DateKey = string; // yyyy-MM-dd

const pad = (n: number) => String(n).padStart(2, "0");

export function makeKey(year: number, month: number, day: number): DateKey {
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parseKey(key: DateKey) {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** Seoul date key for an ISO timestamp or Date. */
export function toKey(value: string | Date): DateKey {
  const t = typeof value === "string" ? Date.parse(value) : value.getTime();
  const s = new Date(t + SEOUL_OFFSET_MS);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

/** ISO string for Seoul midnight of a key — what the web client sends. */
export function keyToIso(key: DateKey): string {
  const { year, month, day } = parseKey(key);
  return new Date(Date.UTC(year, month - 1, day) - SEOUL_OFFSET_MS).toISOString();
}

export function addDays(key: DateKey, days: number): DateKey {
  const { year, month, day } = parseKey(key);
  return makeKey(year, month, day + days);
}

export function weekday(key: DateKey): number {
  const { year, month, day } = parseKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function monthLabel(year: number, month: number) {
  return `${year}년 ${month}월`;
}

export function shortLabel(key: DateKey) {
  const { month, day } = parseKey(key);
  return `${month}월 ${day}일 (${WEEKDAYS[weekday(key)]})`;
}

export function longLabel(key: DateKey) {
  const { month, day } = parseKey(key);
  return `${month}월 ${day}일 ${WEEKDAYS_LONG[weekday(key)]}`;
}

export function dotted(key: DateKey) {
  const { month, day } = parseKey(key);
  return `${month}.${day}`;
}

/** Sunday-first grid covering the month: 5 or 6 weeks of keys. */
export function monthGrid(year: number, month: number) {
  const first = makeKey(year, month, 1);
  const start = addDays(first, -weekday(first));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Math.ceil((weekday(first) + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => {
    const key = addDays(start, i);
    return { key, inMonth: parseKey(key).month === month };
  });
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** True when the all-day event covers the date key. */
export function covers(event: { startDate: string; endDate: string }, key: DateKey) {
  return toKey(event.startDate) <= key && key <= toKey(event.endDate);
}
