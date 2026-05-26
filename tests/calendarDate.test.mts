import test from "node:test";
import assert from "node:assert/strict";

import {
  extractDateKey,
  getCalendarEventEnd,
  getCalendarEventStart,
  isEventOnDate,
  parseApiEventDate,
} from "../lib/calendarDate.ts";

test("all-day event dates keep their date key", () => {
  assert.equal(extractDateKey("2026-05-26T00:00:00.000Z"), "2026-05-26");
  assert.equal(extractDateKey("2026-05-26"), "2026-05-26");
});

test("all-day api dates normalize to utc midnight", () => {
  const parsed = parseApiEventDate("2026-05-26", true);
  assert.ok(parsed);
  assert.equal(parsed?.toISOString(), "2026-05-26T00:00:00.000Z");
});

test("calendar values for all-day events stay date-only", () => {
  const event = {
    startDate: "2026-05-26T00:00:00.000Z",
    endDate: "2026-05-28T00:00:00.000Z",
    allDay: true,
  };

  assert.equal(getCalendarEventStart(event), "2026-05-26");
  assert.equal(getCalendarEventEnd(event), "2026-05-29");
});

test("all-day event comparisons use the calendar date instead of local timezone", () => {
  const event = {
    startDate: "2026-05-26T00:00:00.000Z",
    endDate: "2026-05-28T00:00:00.000Z",
    allDay: true,
  };

  assert.equal(isEventOnDate(event, new Date("2026-05-27T18:45:00-07:00")), true);
  assert.equal(isEventOnDate(event, new Date("2026-05-29T09:00:00-07:00")), false);
});
