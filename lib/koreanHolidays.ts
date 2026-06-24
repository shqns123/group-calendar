import { formatSeoulDateKey, formatSeoulMonthDayKey } from "./seoulTime.ts";

export type CustomHoliday = {
  id: string;
  date: string;
  name: string;
  type: "holiday" | "workday";
};

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

export function getBaseHolidayName(date: Date) {
  return FIXED_HOLIDAYS[formatSeoulMonthDayKey(date)] ?? LUNAR_HOLIDAYS[formatSeoulDateKey(date)] ?? null;
}

export function isBaseHoliday(date: Date) {
  return getBaseHolidayName(date) !== null;
}

export function getCustomHolidayEntry(date: Date, customHolidays: CustomHoliday[] = []) {
  const dateKey = formatSeoulDateKey(date);
  return customHolidays.find((holiday) => holiday.date === dateKey) ?? null;
}

export function getEffectiveHolidayName(date: Date, customHolidays: CustomHoliday[] = []) {
  const customHoliday = getCustomHolidayEntry(date, customHolidays);

  if (customHoliday?.type === "workday") {
    return "대체 근무일";
  }

  if (customHoliday?.type === "holiday") {
    return customHoliday.name;
  }

  return getBaseHolidayName(date);
}

export function isEffectivelyHoliday(date: Date, customHolidays: CustomHoliday[] = []) {
  const customHoliday = getCustomHolidayEntry(date, customHolidays);

  if (customHoliday?.type === "workday") {
    return false;
  }

  if (customHoliday?.type === "holiday") {
    return true;
  }

  return isBaseHoliday(date);
}
