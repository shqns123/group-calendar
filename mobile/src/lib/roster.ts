// Personnel & equipment math — ported from the web
// (components/personnelAvailability.ts, components/equipmentStock.ts).

import { readEquipmentCategories } from "./equipment";
import { rosterOf } from "./session";
import type { CalEvent, Group } from "./types";

export function splitList(raw?: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseAllocation(raw?: string | null) {
  const items: string[] = [];
  let targetCount = 0;
  for (const token of splitList(raw)) {
    const m = /^Target x(\d+)$/i.exec(token);
    if (m) targetCount += Number(m[1]) || 0;
    else items.push(token);
  }
  return { items, targetCount };
}

export function formatAllocation(items: string[], targetCount: number) {
  return [...items, ...(targetCount > 0 ? [`Target x${targetCount}`] : [])].join(", ");
}

/** Events that occupy people/equipment on a day (overtime markers excluded). */
function workEvents(events: CalEvent[]) {
  return events.filter((e) => !e.isOvertimeOnly);
}

export function personnelFor(group: Group | null, dayEvents: CalEvent[]) {
  const roster = rosterOf(group);
  const set = new Set(roster);
  const assigned = new Set<string>();
  for (const e of workEvents(dayEvents)) {
    if (e.equipmentOnly) continue;
    const labels = splitList(e.personnel);
    const resolved = labels.length > 0 ? labels : [e.creatorNickname || e.creator.name || ""];
    for (const l of resolved) if (set.has(l)) assigned.add(l);
  }
  const overtime = dayEvents
    .filter((e) => e.isOvertimeOnly && e.overtimeAvailable)
    .flatMap((e) => splitList(e.personnel));
  const overtimeNo = dayEvents
    .filter((e) => e.isOvertimeOnly && !e.overtimeAvailable)
    .flatMap((e) => splitList(e.personnel));
  const yes = Array.from(new Set(overtime));
  return {
    total: roster.length,
    remaining: roster.filter((l) => !assigned.has(l)),
    overtime: yes,
    overtimeNo: Array.from(new Set(overtimeNo)),
    // Marked 가능 and not away on 출장 / 근태 that day — who can actually work in 울산.
    overtimeHere: yes.filter((l) => !assigned.has(l)),
  };
}

export function equipmentFor(group: Group | null, dayEvents: CalEvent[], excludeEventId?: string) {
  const categories = readEquipmentCategories(group);
  const used = new Set<string>();
  const quantities = new Map<string, number>();
  for (const e of workEvents(dayEvents)) {
    if (e.id === excludeEventId) continue;
    for (const token of splitList(e.equipment)) {
      const match = /^(.*) x(\d+)$/i.exec(token);
      if (match && categories.some((category) => category.quantity !== undefined && [category.id === "target" ? "Target" : category.name, ...(category.aliases ?? [])].includes(match[1]))) quantities.set(match[1], (quantities.get(match[1]) ?? 0) + Number(match[2]));
      else used.add(token);
    }
  }
  return {
    categories: categories.map((cat) => ({ ...cat, remaining: cat.items.filter((i) => !used.has(i)), quantityRemaining: cat.quantity === undefined ? undefined : Math.max(0, cat.quantity - [cat.id === "target" ? "Target" : cat.name, ...(cat.aliases ?? [])].reduce((sum, name) => sum + (quantities.get(name) ?? 0), 0)) })),
    used,
    targetTotal: 0,
    targetRemaining: 0,
    hasAny: categories.some((cat) => (cat.quantity ?? cat.items.length) > 0),
  };
}
