// Data for the home-screen widgets: the same list as the 일정 요약 tab — 근태 + 출장 (no 특근 marks)
// from today up to three months ahead, in the same sections (오늘 / 내일 / 이번 주 / 이번 달 /
// 다음 달 이후). Runs in Android's background JS task, so it reads the session token and the chosen
// group straight from SecureStore (no React context there).
import * as SecureStore from "expo-secure-store";
import { api, ApiError, DEMO, getToken } from "@/lib/api";
import { addDays, keyToIso, parseKey, todayKey, toKey, WEEKDAYS, weekday, type DateKey } from "@/lib/date";
import { splitList } from "@/lib/roster";
import type { CalEvent, Group, Me } from "@/lib/types";

/** The group the app last showed — the widget follows it. Written by the app (see widgetSync). */
export const WIDGET_GROUP_KEY = "widget-group";
const DEFAULT_GROUP_KEY = "default-group-id";
/** Same horizon as the summary tab. */
const HORIZON_DAYS = 92;

export type WidgetEvent = {
  id: string;
  title: string;
  color: string;
  /** Day the event sits on (its start, or today if it started earlier). Taps open this day. */
  dayKey: DateKey;
  /** "13" */
  day: string;
  /** "금" — or "12월" in 다음 달 이후, like the summary tab. */
  dayNote: string;
  /** "김민수, 최유진" or "11.20 – 11.22 · 김민수" — second line in the larger sizes. */
  sub: string;
  kind: "trip" | "leave";
};

export type SectionKey = "today" | "tomorrow" | "week" | "month" | "later";
export type WidgetSection = { key: SectionKey; label: string; events: WidgetEvent[] };

export type WidgetData =
  | { state: "ok"; groupName: string; sections: WidgetSection[]; total: number; updatedAt: string }
  | { state: "signedOut" }
  | { state: "noGroup" }
  | { state: "error"; message: string };

const LABEL: Record<SectionKey, string> = { today: "오늘", tomorrow: "내일", week: "이번 주", month: "이번 달", later: "다음 달 이후" };
const ORDER: SectionKey[] = ["today", "tomorrow", "week", "month", "later"];
const pad = (n: number) => String(n).padStart(2, "0");
const dotted = (k: DateKey) => `${parseKey(k).month}.${parseKey(k).day}`;

async function readGroup(): Promise<{ id: string; name: string } | null> {
  try {
    const raw = await SecureStore.getItemAsync(WIDGET_GROUP_KEY);
    if (raw) {
      const g = JSON.parse(raw) as { id?: string; name?: string };
      if (g.id) return { id: g.id, name: g.name ?? "" };
    }
  } catch {
    // fall through to asking the server
  }
  // Not set yet (app not opened since the update): same rule as the app — default group, else the first of mine.
  const { user } = await api<{ user: Me }>("/api/auth/me");
  const all = await api<Group[]>("/api/groups");
  const mine = all.filter((g) => g.leaderId === user.id || g.members.some((m) => m.userId === user.id && (m.status === "ACTIVE" || m.status == null)));
  const saved = await SecureStore.getItemAsync(DEFAULT_GROUP_KEY).catch(() => null);
  const g = mine.find((x) => x.id === saved) ?? mine[0];
  return g ? { id: g.id, name: g.name } : null;
}

export async function loadWidgetData(today: DateKey = todayKey()): Promise<WidgetData> {
  try {
    if (!DEMO && !(await getToken())) return { state: "signedOut" };
    const group = await readGroup();
    if (!group) return { state: "noGroup" };
    const events = await api<CalEvent[]>("/api/events", { query: { groupId: group.id, start: keyToIso(today), end: keyToIso(addDays(today, HORIZON_DAYS)) } });

    // Same buckets as the summary tab.
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, 6 - weekday(today));
    const { year, month } = parseKey(today);
    const buckets: Record<SectionKey, WidgetEvent[]> = { today: [], tomorrow: [], week: [], month: [], later: [] };
    const sorted = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));
    for (const e of sorted) {
      if (e.isOvertimeOnly) continue;
      const s = toKey(e.startDate) < today ? today : toKey(e.startDate);
      const p = parseKey(s);
      const b: SectionKey = s === today ? "today" : s === tomorrow ? "tomorrow" : s <= weekEnd ? "week" : p.year === year && p.month === month ? "month" : "later";
      const end = toKey(e.endDate);
      const who = e.equipmentOnly ? (e.equipment ?? "") : splitList(e.personnel).join(", ");
      buckets[b].push({
        id: e.id,
        title: e.title,
        color: /^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : "#4F46E5",
        dayKey: s,
        day: String(p.day),
        dayNote: b === "later" ? `${p.month}월` : WEEKDAYS[weekday(s)],
        sub: [toKey(e.startDate) !== end ? `${dotted(toKey(e.startDate))} – ${dotted(end)}` : null, who || null].filter(Boolean).join(" · "),
        kind: e.category === "ATTENDANCE" ? "leave" : "trip",
      });
    }
    const sections = ORDER.filter((k) => buckets[k].length > 0).map((k) => ({ key: k, label: LABEL[k], events: buckets[k] }));
    const now = new Date();
    return {
      state: "ok",
      groupName: group.name,
      sections,
      total: sections.reduce((n, s) => n + s.events.length, 0),
      updatedAt: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return { state: "signedOut" };
    return { state: "error", message: e instanceof ApiError && e.status === 0 ? "연결 안 됨" : "불러오지 못했어요" };
  }
}
