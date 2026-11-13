// Personnel & equipment math — ported from the web
// (components/personnelAvailability.ts, components/equipmentStock.ts).

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
  const trackers = splitList(group?.trackerOptions);
  const laptops = splitList(group?.laptopOptions);
  const targetTotal = Math.max(0, group?.targetCount ?? 2);
  const used = new Set<string>();
  let targetUsed = 0;
  for (const e of workEvents(dayEvents)) {
    if (e.id === excludeEventId) continue;
    const a = parseAllocation(e.equipment);
    targetUsed += a.targetCount;
    a.items.forEach((i) => used.add(i));
  }
  return {
    trackers,
    laptops,
    used,
    targetTotal,
    targetRemaining: Math.max(0, targetTotal - targetUsed),
    trackerRemaining: trackers.filter((t) => !used.has(t)).length,
    laptopRemaining: laptops.filter((t) => !used.has(t)).length,
  };
}
