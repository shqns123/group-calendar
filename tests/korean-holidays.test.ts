import test from "node:test";
import assert from "node:assert/strict";

import {
  getBaseHolidayName,
  getEffectiveHolidayName,
  isBaseHoliday,
  isEffectivelyHoliday,
  type CustomHoliday,
} from "../lib/koreanHolidays.ts";
import { parseSeoulDateInput } from "../lib/seoulTime.ts";

test("returns the correct base holiday name for 2026 Chuseok", () => {
  assert.equal(getBaseHolidayName(parseSeoulDateInput("2026-09-24")), "추석 연휴");
  assert.equal(getBaseHolidayName(parseSeoulDateInput("2026-09-25")), "추석");
  assert.equal(getBaseHolidayName(parseSeoulDateInput("2026-09-26")), "추석 연휴");
});

test("does not mark the incorrect pre-holiday date as Chuseok", () => {
  assert.equal(getBaseHolidayName(parseSeoulDateInput("2026-09-23")), null);
  assert.equal(isBaseHoliday(parseSeoulDateInput("2026-09-23")), false);
});

test("preserves the correct 2026 Lunar New Year date", () => {
  assert.equal(getBaseHolidayName(parseSeoulDateInput("2026-02-17")), "설날");
  assert.equal(isBaseHoliday(parseSeoulDateInput("2026-02-17")), true);
});

test("allows company workday overrides on top of base holidays", () => {
  const customHolidays: CustomHoliday[] = [
    { id: "1", date: "2026-09-25", name: "출근", type: "workday" },
  ];

  assert.equal(getEffectiveHolidayName(parseSeoulDateInput("2026-09-25"), customHolidays), "대체 근무일");
  assert.equal(isEffectivelyHoliday(parseSeoulDateInput("2026-09-25"), customHolidays), false);
});

test("allows company holiday overrides on normal weekdays", () => {
  const customHolidays: CustomHoliday[] = [
    { id: "2", date: "2026-09-23", name: "회사 휴일", type: "holiday" },
  ];

  assert.equal(getEffectiveHolidayName(parseSeoulDateInput("2026-09-23"), customHolidays), "회사 휴일");
  assert.equal(isEffectivelyHoliday(parseSeoulDateInput("2026-09-23"), customHolidays), true);
});
