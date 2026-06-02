import test from "node:test";
import assert from "node:assert/strict";

import {
  canEditDayNote,
  createDayNoteEntry,
  expandDayNoteDateRange,
  hasDayNoteContent,
  normalizeDayNoteEntries,
  normalizeDayNoteItems,
  normalizeDayNoteContent,
  parseDayNoteEntries,
  parseDayNoteItems,
  serializeDayNoteEntries,
  serializeDayNoteItems,
} from "../lib/dayNotes.ts";

test("allows editing for operator, group leader, part leader, and admin role", () => {
  assert.equal(canEditDayNote({ isOperator: true }), true);
  assert.equal(canEditDayNote({ isGroupAdmin: true }), true);
  assert.equal(canEditDayNote({ memberRole: "그룹장" }), true);
  assert.equal(canEditDayNote({ memberRole: "파트장" }), true);
  assert.equal(canEditDayNote({ memberRole: "ADMIN" }), true);
});

test("rejects editing for regular members and observers", () => {
  assert.equal(canEditDayNote({ memberRole: "MEMBER" }), false);
  assert.equal(canEditDayNote({ memberRole: "OBSERVER" }), false);
  assert.equal(canEditDayNote({}), false);
});

test("normalizes day note content and stores empty values as null", () => {
  assert.equal(normalizeDayNoteContent("  현장 출발 8시  "), "현장 출발 8시");
  assert.equal(normalizeDayNoteContent("   "), null);
  assert.equal(normalizeDayNoteContent(null), null);
});

test("detects whether a day note should activate the icon", () => {
  assert.equal(hasDayNoteContent("업무 내용 있음", "2026-06-02"), true);
  assert.equal(hasDayNoteContent("  ", "2026-06-02"), false);
  assert.equal(hasDayNoteContent(null, "2026-06-02"), false);
});

test("normalizes legacy plain-text items by trimming and removing empty rows", () => {
  assert.deepEqual(
    normalizeDayNoteItems(["  첫 업무  ", " ", "", "두번째 업무"]),
    ["첫 업무", "두번째 업무"],
  );
});

test("creates entry objects with sorted ranges while preserving draft text", () => {
  assert.deepEqual(
    createDayNoteEntry("2026-06-02", {
      id: "entry-1",
      text: "  장비 점검 ",
      startDate: "2026-06-04",
      endDate: "2026-06-02",
    }),
    {
      id: "entry-1",
      text: "  장비 점검 ",
      startDate: "2026-06-02",
      endDate: "2026-06-04",
    },
  );
});

test("preserves in-progress spaces while editing and trims on normalization", () => {
  const draft = createDayNoteEntry("2026-06-02", {
    id: "entry-1",
    text: "현장 출발 ",
  });

  assert.equal(draft.text, "현장 출발 ");
  assert.deepEqual(normalizeDayNoteEntries([draft], "2026-06-02"), [
    {
      id: "entry-1",
      text: "현장 출발",
      startDate: "2026-06-02",
      endDate: "2026-06-02",
    },
  ]);
});

test("serializes and parses entry-based day notes", () => {
  const serialized = serializeDayNoteEntries(
    [
      {
        id: "entry-1",
        text: "출발 8시",
        startDate: "2026-06-02",
        endDate: "2026-06-04",
      },
    ],
    "2026-06-02",
  );

  assert.deepEqual(parseDayNoteEntries(serialized, "2026-06-02"), [
    {
      id: "entry-1",
      text: "출발 8시",
      startDate: "2026-06-02",
      endDate: "2026-06-04",
    },
  ]);
});

test("parses legacy string arrays into dated entries", () => {
  assert.deepEqual(parseDayNoteEntries(serializeDayNoteItems(["기존 메모"]), "2026-06-02"), [
    {
      id: "legacy-2026-06-02-0",
      text: "기존 메모",
      startDate: "2026-06-02",
      endDate: "2026-06-02",
    },
  ]);
});

test("parses legacy plain-text day notes into a single list item", () => {
  assert.deepEqual(parseDayNoteItems("기존 단일 메모", "2026-06-02"), ["기존 단일 메모"]);
});

test("normalizes entry objects and drops empty text rows", () => {
  assert.deepEqual(
    normalizeDayNoteEntries(
      [
        { id: "a", text: " 첫 업무 ", startDate: "2026-06-02", endDate: "2026-06-02" },
        { id: "b", text: "   ", startDate: "2026-06-02", endDate: "2026-06-03" },
      ],
      "2026-06-02",
    ),
    [
      { id: "a", text: "첫 업무", startDate: "2026-06-02", endDate: "2026-06-02" },
    ],
  );
});

test("expands a date range into inclusive Seoul date keys", () => {
  assert.deepEqual(
    expandDayNoteDateRange("2026-06-02", "2026-06-04"),
    ["2026-06-02", "2026-06-03", "2026-06-04"],
  );
});
