import { covers, type DateKey } from "./date";
import { splitList } from "./roster";
import type { CalEvent } from "./types";

export type DayChip = { key: string; label: string; color: string };

/** Chips for one calendar day; overtime markers collapse into one chip per state. */
export function chipsFor(events: CalEvent[], day: DateKey): DayChip[] {
  const today = events.filter((e) => covers(e, day));
  const chips: DayChip[] = [];
  const otYes: string[] = [];
  const otNo: string[] = [];
  for (const e of today) {
    if (e.isOvertimeOnly) {
      const who = splitList(e.personnel)[0] ?? e.creator.name ?? "";
      (e.overtimeAvailable ? otYes : otNo).push(who);
      continue;
    }
    const who = splitList(e.personnel)[0];
    const label = e.category === "ATTENDANCE" && who ? `${e.title} ${who}` : e.title;
    chips.push({ key: e.id, label, color: e.color });
  }
  if (otYes.length) chips.push({ key: "ot-yes", label: otYes.length > 1 ? `특근 가능 ${otYes.length}` : `특근 가능 ${otYes[0]}`, color: "#F59E0B" });
  if (otNo.length) chips.push({ key: "ot-no", label: otNo.length > 1 ? `특근 불가 ${otNo.length}` : `특근 불가 ${otNo[0]}`, color: "#EF4444" });
  return chips;
}

export function eventsOn(events: CalEvent[], day: DateKey) {
  return events.filter((e) => covers(e, day));
}
