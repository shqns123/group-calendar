import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDateRangeSelection,
  buildDateRangeCalendar,
  formatDateRangeLabel,
  getDateRangePhaseLabel,
  shiftDateRangeMonth,
} from "../lib/dateRange.ts";

test("formats a single-day range as one date", () => {
  assert.equal(formatDateRangeLabel("2026-05-26", "2026-05-26"), "26.05.26");
});

test("formats a multi-day range with a separator", () => {
  assert.equal(
    formatDateRangeLabel("2026-05-26", "2026-05-28"),
    "26.05.26 ~ 26.05.28",
  );
});

test("first selection starts a new range", () => {
  assert.deepEqual(
    applyDateRangeSelection({
      currentStart: "2026-05-20",
      currentEnd: "2026-05-22",
      pickedDate: "2026-05-26",
      phase: "start",
    }),
    {
      startDate: "2026-05-26",
      endDate: "2026-05-26",
      nextPhase: "end",
    },
  );
});

test("second selection extends the end date", () => {
  assert.deepEqual(
    applyDateRangeSelection({
      currentStart: "2026-05-26",
      currentEnd: "2026-05-26",
      pickedDate: "2026-05-28",
      phase: "end",
    }),
    {
      startDate: "2026-05-26",
      endDate: "2026-05-28",
      nextPhase: "start",
    },
  );
});

test("second selection before the start swaps the range", () => {
  assert.deepEqual(
    applyDateRangeSelection({
      currentStart: "2026-05-26",
      currentEnd: "2026-05-26",
      pickedDate: "2026-05-24",
      phase: "end",
    }),
    {
      startDate: "2026-05-24",
      endDate: "2026-05-26",
      nextPhase: "start",
    },
  );
});

test("builds a six-row month grid and marks the selected range", () => {
  const days = buildDateRangeCalendar({
    viewMonth: "2026-05",
    startDate: "2026-05-26",
    endDate: "2026-05-29",
  });

  assert.equal(days.length, 42);

  const rangeDays = days.filter((day) => day.isInRange).map((day) => day.dateKey);
  assert.deepEqual(rangeDays, [
    "2026-05-26",
    "2026-05-27",
    "2026-05-28",
    "2026-05-29",
  ]);

  assert.equal(days.find((day) => day.dateKey === "2026-05-26")?.isRangeStart, true);
  assert.equal(days.find((day) => day.dateKey === "2026-05-29")?.isRangeEnd, true);
});

test("shifts calendar month forward and backward", () => {
  assert.equal(shiftDateRangeMonth("2026-05", -1), "2026-04");
  assert.equal(shiftDateRangeMonth("2026-05", 1), "2026-06");
  assert.equal(shiftDateRangeMonth("2026-01", -1), "2025-12");
});

test("returns a readable phase label", () => {
  assert.equal(getDateRangePhaseLabel("start"), "시작일 선택 중");
  assert.equal(getDateRangePhaseLabel("end"), "종료일 선택 중");
});
