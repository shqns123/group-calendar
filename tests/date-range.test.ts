import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDateRangeSelection,
  formatDateRangeLabel,
} from "../lib/dateRange.ts";

test("formats a single-day range as one date", () => {
  assert.equal(formatDateRangeLabel("2026-05-26", "2026-05-26"), "2026-05-26");
});

test("formats a multi-day range with a separator", () => {
  assert.equal(
    formatDateRangeLabel("2026-05-26", "2026-05-28"),
    "2026-05-26 ~ 2026-05-28",
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
