// Month-grid rules, matching the web calendar (components/CalendarView.tsx):
//  - Bars: business trips only (no attendance, overtime markers or equipment-only),
//    multi-day events drawn as one continuous bar across each week row.
//  - Attendance → blue dot, overtime available → red dot (bottom-right of the cell).
//    The overtime dot shows only your own marks, or everyone's for leaders.
//  - At most `group.eventDisplayLimit` (default 3) bar lanes, then "+N".

import { covers, toKey, type DateKey } from "./date";
import type { CalEvent, Group, Me } from "./types";

export function isBarEvent(e: CalEvent) {
  return !e.isOvertimeOnly && !e.equipmentOnly && (e.category ?? "BUSINESS_TRIP") !== "ATTENDANCE";
}

export function isAttendance(e: CalEvent) {
  return !e.isOvertimeOnly && !e.equipmentOnly && e.category === "ATTENDANCE";
}

/** Leader, part leader, group admin or operator — same as the web's isElevated(). */
export function isElevated(group: Group | null, me: Me | null) {
  if (!group || !me) return false;
  if (me.isOperator || group.leaderId === me.id) return true;
  const role = group.members.find((m) => m.userId === me.id)?.role;
  return role === "그룹장" || role === "파트장";
}

export type Segment = {
  id: string;
  title: string;
  color: string;
  startCol: number;
  span: number;
  lane: number;
  roundStart: boolean; // the event really starts in this week
  roundEnd: boolean; // the event really ends in this week
};

export type WeekLayout = {
  segments: Segment[];
  hidden: number[]; // per column: bars that did not fit
  total: number[]; // per column: all bars
  cellTint: { color: string | null; joinPrev: boolean; joinNext: boolean }[]; // per column: top bar wash
};

export function layoutWeek(events: CalEvent[], week: DateKey[], maxLanes: number): WeekLayout {
  const wStart = week[0];
  const wEnd = week[week.length - 1];
  const bars = events
    .filter(isBarEvent)
    .map((e) => ({ e, s: toKey(e.startDate), t: toKey(e.endDate) }))
    .filter(({ s, t }) => s <= wEnd && t >= wStart)
    .sort((a, b) => (a.s === b.s ? b.t.localeCompare(a.t) : a.s.localeCompare(b.s)));

  const laneEnds: number[] = [];
  const placed: Segment[] = [];
  for (const { e, s, t } of bars) {
    const startCol = s < wStart ? 0 : week.indexOf(s);
    const endCol = t > wEnd ? week.length - 1 : week.indexOf(t);
    let lane = laneEnds.findIndex((end) => end < startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endCol);
    } else {
      laneEnds[lane] = endCol;
    }
    placed.push({ id: e.id, title: e.title, color: e.color, startCol, span: endCol - startCol + 1, lane, roundStart: s >= wStart, roundEnd: t <= wEnd });
  }

  const lanes = laneEnds.length;
  // "+N" has its own reserved strip at the bottom of the cell, so an overflowing week still
  // shows every lane that fits (it used to give up one more lane for "+N").
  const visibleLanes = Math.min(lanes, maxLanes);
  const total = week.map((_, col) => placed.filter((p) => col >= p.startCol && col < p.startCol + p.span).length);
  const hidden = week.map((_, col) => placed.filter((p) => p.lane >= visibleLanes && col >= p.startCol && col < p.startCol + p.span).length);
  // Day background follows the top bar on that day (lowest lane): the cell takes a lighter
  // wash of that bar's color, and a multi-day top bar joins its cells into one block.
  const top = week.map((_, col) =>
    placed.filter((p) => col >= p.startCol && col < p.startCol + p.span).sort((a, b) => a.lane - b.lane)[0] ?? null,
  );
  const cellTint = top.map((t, col) => ({
    color: t?.color ?? null,
    joinPrev: !!t && col > 0 && top[col - 1]?.id === t.id,
    joinNext: !!t && col < week.length - 1 && top[col + 1]?.id === t.id,
  }));
  return { segments: placed.filter((p) => p.lane < visibleLanes), hidden, total, cellTint };
}

export function dayMarks(events: CalEvent[], day: DateKey, me: Me | null, elevated: boolean) {
  let attendance = false;
  let overtime = false;
  for (const e of events) {
    if (!covers(e, day)) continue;
    if (isAttendance(e)) attendance = true;
    if (e.overtimeAvailable && (elevated || e.creatorId === me?.id)) overtime = true;
  }
  return { attendance, overtime };
}

export function eventsOn(events: CalEvent[], day: DateKey) {
  return events.filter((e) => covers(e, day));
}
