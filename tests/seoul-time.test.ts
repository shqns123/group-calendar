import test from "node:test";
import assert from "node:assert/strict";

import {
  addSeoulDays,
  formatSeoulDateKey,
  getSeoulDayRange,
  parseSeoulDateInput,
  toSeoulDateInput,
} from "../lib/seoulTime.ts";

test("keeps all-day event on the same Seoul date even when host timezone changes", () => {
  process.env.TZ = "America/Los_Angeles";

  assert.equal(
    formatSeoulDateKey("2026-05-26T00:00:00.000Z"),
    "2026-05-26",
  );
});

test("parses date input as Seoul midnight and round-trips the date key", () => {
  process.env.TZ = "America/Los_Angeles";

  const parsed = parseSeoulDateInput("2026-05-26");

  assert.equal(parsed.toISOString(), "2026-05-25T15:00:00.000Z");
  assert.equal(toSeoulDateInput(parsed), "2026-05-26");
});

test("creates inclusive Seoul day ranges for day-based filters", () => {
  process.env.TZ = "America/Los_Angeles";

  const range = getSeoulDayRange("2026-05-26");

  assert.equal(range.start.toISOString(), "2026-05-25T15:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-05-26T14:59:59.999Z");
});

test("adds days in Seoul calendar space", () => {
  process.env.TZ = "America/Los_Angeles";

  const nextDay = addSeoulDays("2026-05-26T00:00:00.000Z", 1);

  assert.equal(formatSeoulDateKey(nextDay), "2026-05-27");
});
