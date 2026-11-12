// Korean public holidays + company holidays/workdays — ported from the web
// (lib/koreanHolidays.ts). Keep the two lists in sync when adding years.

import type { DateKey } from "./date";
import type { CustomHoliday } from "./types";

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
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  "2025-05-05": "부처님오신날",
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-05-24": "부처님오신날",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
};

export function baseHolidayName(key: DateKey) {
  return FIXED_HOLIDAYS[key.slice(5)] ?? LUNAR_HOLIDAYS[key] ?? null;
}

/** Holiday state for a date: company settings override public holidays. */
export function holidayInfo(key: DateKey, custom: CustomHoliday[]) {
  const c = custom.find((h) => h.date === key);
  if (c?.type === "workday") return { holiday: false, workday: true, name: c.name };
  if (c?.type === "holiday") return { holiday: true, workday: false, name: c.name };
  const base = baseHolidayName(key);
  return { holiday: base != null, workday: false, name: base };
}
