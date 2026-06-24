const DAY_NOTE_EDITOR_ROLES = new Set(["ADMIN", "그룹장", "파트장"]);
const MAX_DAY_NOTE_ITEMS = 20;

import { addSeoulDays, formatSeoulDateKey } from "./seoulTime";

export type DayNoteEntry = {
  id: string;
  text: string;
  assignee: string;
  startDate: string;
  endDate: string;
};

type DayNotePermissionInput = {
  isOperator?: boolean;
  isGroupAdmin?: boolean;
  memberRole?: string | null;
};

type ParsedEntryObject = {
  id?: unknown;
  text?: unknown;
  assignee?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

function isDateKey(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeRange(startDate: string, endDate: string) {
  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
}

export function canEditDayNote({
  isOperator = false,
  isGroupAdmin = false,
  memberRole,
}: DayNotePermissionInput): boolean {
  if (isOperator || isGroupAdmin) return true;
  if (!memberRole) return false;
  return DAY_NOTE_EDITOR_ROLES.has(memberRole);
}

export function normalizeDayNoteContent(content: string | null | undefined): string | null {
  const trimmed = content?.trim();
  return trimmed ? trimmed : null;
}

export function createDayNoteEntry(dateKey: string, overrides: Partial<DayNoteEntry> = {}): DayNoteEntry {
  const baseText = typeof overrides.text === "string" ? overrides.text : "";
  const baseAssignee = typeof overrides.assignee === "string" ? overrides.assignee : "";
  const startDate = isDateKey(overrides.startDate) ? overrides.startDate : dateKey;
  const endDate = isDateKey(overrides.endDate) ? overrides.endDate : dateKey;
  const range = normalizeRange(startDate, endDate);

  return {
    id: overrides.id?.trim() || `day-note-${Math.random().toString(36).slice(2, 10)}`,
    text: baseText,
    assignee: baseAssignee,
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

export function normalizeDayNoteEntries(entries: DayNoteEntry[], fallbackDate: string): DayNoteEntry[] {
  return entries
    .map((entry) => {
      const normalizedText = normalizeDayNoteContent(entry.text) ?? "";
      const normalizedAssignee = normalizeDayNoteContent(entry.assignee) ?? "";
      return createDayNoteEntry(fallbackDate, {
        ...entry,
        text: normalizedText,
        assignee: normalizedAssignee,
      });
    })
    .filter((entry) => entry.text.length > 0)
    .slice(0, MAX_DAY_NOTE_ITEMS);
}

export function hasDayNoteContent(content: string | null | undefined, fallbackDate = "1970-01-01"): boolean {
  return parseDayNoteEntries(content, fallbackDate).length > 0;
}

export function serializeDayNoteEntries(entries: DayNoteEntry[], fallbackDate: string): string | null {
  const normalized = normalizeDayNoteEntries(entries, fallbackDate);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

export function parseDayNoteEntries(content: string | null | undefined, fallbackDate: string): DayNoteEntry[] {
  const normalized = normalizeDayNoteContent(content);
  if (!normalized) return [];

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (Array.isArray(parsed)) {
      const entries = parsed.flatMap((item, index) => {
        if (typeof item === "string") {
          return [
            createDayNoteEntry(fallbackDate, {
              id: `legacy-${fallbackDate}-${index}`,
              text: item,
              assignee: "",
            }),
          ];
        }

        if (item && typeof item === "object") {
          const candidate = item as ParsedEntryObject;
          return [
            createDayNoteEntry(fallbackDate, {
              id: typeof candidate.id === "string" ? candidate.id : `entry-${fallbackDate}-${index}`,
              text: typeof candidate.text === "string" ? candidate.text : "",
              assignee: typeof candidate.assignee === "string" ? candidate.assignee : "",
              startDate: typeof candidate.startDate === "string" ? candidate.startDate : fallbackDate,
              endDate: typeof candidate.endDate === "string" ? candidate.endDate : fallbackDate,
            }),
          ];
        }

        return [];
      });

      return normalizeDayNoteEntries(entries, fallbackDate);
    }
  } catch {
    // Support legacy plain-text values.
  }

  return [
    createDayNoteEntry(fallbackDate, {
      id: `legacy-${fallbackDate}-0`,
      text: normalized,
      assignee: "",
    }),
  ];
}

export function parseDayNoteItems(content: string | null | undefined, fallbackDate = "1970-01-01"): string[] {
  return parseDayNoteEntries(content, fallbackDate).map((entry) => entry.text);
}

export function normalizeDayNoteItems(items: string[]): string[] {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_DAY_NOTE_ITEMS);
}

export function serializeDayNoteItems(items: string[]): string | null {
  const normalized = normalizeDayNoteItems(items);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

export function expandDayNoteDateRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];
  const range = normalizeRange(startDate, endDate);
  const dates: string[] = [];
  let current = range.startDate;

  while (current <= range.endDate) {
    dates.push(current);
    current = formatSeoulDateKey(addSeoulDays(current, 1));
  }

  return dates;
}
