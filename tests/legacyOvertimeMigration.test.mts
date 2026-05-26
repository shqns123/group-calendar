import assert from "node:assert/strict";
import test from "node:test";

import {
  isLegacyOvertimeMigrationCandidate,
  normalizeLegacyOvertimeDate,
} from "../lib/legacyOvertimeMigration.ts";

test("legacy overtime entries saved in Seoul local midnight are detected", () => {
  assert.equal(
    isLegacyOvertimeMigrationCandidate({
      allDay: true,
      isOvertimeOnly: true,
      startDate: new Date("2026-05-25T15:00:00.000Z"),
      endDate: new Date("2026-05-25T15:00:00.000Z"),
    }),
    true,
  );
});

test("already normalized overtime entries are ignored", () => {
  assert.equal(
    isLegacyOvertimeMigrationCandidate({
      allDay: true,
      isOvertimeOnly: true,
      startDate: new Date("2026-05-26T00:00:00.000Z"),
      endDate: new Date("2026-05-26T00:00:00.000Z"),
    }),
    false,
  );
});

test("normalization keeps the intended Seoul date and rewrites it to utc midnight", () => {
  assert.equal(
    normalizeLegacyOvertimeDate(new Date("2026-05-25T15:00:00.000Z")).toISOString(),
    "2026-05-26T00:00:00.000Z",
  );
});
