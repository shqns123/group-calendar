// Demo mode (EXPO_PUBLIC_DEMO=1 or no EXPO_PUBLIC_API_URL): an in-memory stand-in
// for the server so screens can be previewed without signing in.

import { addDays, keyToIso, todayKey, toKey, covers } from "./date";
import { parseQuickAdd } from "./quickAdd";
import type { AdminUser, AppNotification, CalEvent, CustomHoliday, Group, Me, NotificationSchedule, PendingUser } from "./types";

// Demo user is the group admin and an operator, so every management screen is visible.
const me: Me = { id: "u1", name: "김민수", email: null, status: "ACTIVE", isOperator: true };
const names = ["김민수", "이서연", "박지훈", "최유진", "정하늘", "한도윤", "오세린"];

const group: Group = {
  id: "g1",
  name: "기술지원 1팀",
  leaderId: "u1",
  trackerOptions: "T-01, T-02, T-03, T-04",
  laptopOptions: "N-01, N-02, N-03, N-04",
  targetCount: 2,
  eventDisplayLimit: 3,
  inviteCode: "AB12CD",
  members: [
    ...names.map((n, i) => ({
      id: `m${i + 1}`,
      userId: `u${i + 1}`,
      nickname: null,
      role: i === 1 ? "그룹장" : i === 2 ? "파트장" : "MEMBER",
      status: "ACTIVE",
      canNotify: i === 1,
      user: { id: `u${i + 1}`, name: n },
    })),
    { id: "m9", userId: "u9", nickname: null, role: "MEMBER", status: "PENDING", canNotify: false, user: { id: "u9", name: "윤지아", email: "jia@example.com" } },
  ],
};

let holidays: CustomHoliday[] = [{ id: "h1", date: addDays(todayKey(), 9), name: "창립기념일", type: "holiday" }];
let schedules: NotificationSchedule[] = [{ id: "s1", groupId: "g1", message: "오늘 일정 확인해 주세요", dayOfWeek: "1,2,3,4,5", timeHour: 8, timeMin: 30, active: true }];
let pendingUsers: PendingUser[] = [{ id: "u10", name: "강하은", email: "haeun@example.com", employeeId: null, createdAt: new Date().toISOString() }];
const personalNotes: Record<string, { id: string; text: string }[]> = {};

let seq = 100;
const t = todayKey();
function ev(offset: number, len: number, partial: Partial<CalEvent>): CalEvent {
  const start = addDays(t, offset);
  return {
    id: `e${seq++}`,
    category: "BUSINESS_TRIP",
    title: "",
    startDate: keyToIso(start),
    endDate: keyToIso(addDays(start, len - 1)),
    allDay: true,
    color: "#3B82F6",
    overtimeAvailable: false,
    isOvertimeOnly: false,
    equipmentOnly: false,
    personnel: null,
    equipment: null,
    creatorId: "u1",
    groupId: "g1",
    creator: { id: "u1", name: "김민수" },
    ...partial,
  };
}

let events: CalEvent[] = [
  ev(-8, 3, { title: "부산 출장", personnel: "김민수, 정하늘", equipment: "T-02" }),
  ev(-5, 1, { category: "ATTENDANCE", title: "월휴", personnel: "김민수", color: "#8B5CF6" }),
  ev(-2, 2, { title: "장비 반출", equipmentOnly: true, equipment: "N-04", color: "#14B8A6" }),
  ev(0, 1, { title: "울산 출장", personnel: "김민수, 최유진", equipment: "T-01, N-02", color: "#3B82F6" }),
  ev(0, 1, { category: "ATTENDANCE", title: "유휴", personnel: "이서연", color: "#EC4899" }),
  ev(1, 2, {
    title: "광주 출장",
    description: "광주 현장 장비 설치와 점검. 타겟은 전날 반출.",
    personnel: "김민수, 최유진",
    equipment: "T-03, N-01, Target x1",
    color: "#F97316",
  }),
  ev(1, 1, { category: "ATTENDANCE", title: "월휴", personnel: "박지훈", color: "#8B5CF6", creatorId: "u3" }),
  ev(1, 1, { title: "특근 가능", isOvertimeOnly: true, overtimeAvailable: true, personnel: "이서연", color: "#F59E0B", creatorId: "u2" }),
  ev(3, 1, { title: "특근 가능", isOvertimeOnly: true, overtimeAvailable: true, personnel: "정하늘", color: "#F59E0B", creatorId: "u5" }),
  ev(6, 3, { title: "인천 출장", personnel: "한도윤, 오세린", equipment: "T-04", color: "#6366F1" }),
  ev(9, 1, { category: "ATTENDANCE", title: "무휴", personnel: "최유진", color: "#8B5CF6" }),
  ev(13, 3, { title: "평택 출장", personnel: "김민수, 정하늘", color: "#10B981" }),
  ev(24, 2, { title: "대구 출장", personnel: "박지훈", color: "#3B82F6" }),
];

let notifications: AppNotification[] = [
  { id: "n1", groupId: "g1", type: "EVENT_CREATED", title: "새 일정 등록", body: "김민수 님이 광주 출장을 등록했습니다.", createdAt: new Date(Date.now() - 600_000).toISOString(), readAt: null, eventCategory: "BUSINESS_TRIP", targetDate: addDays(t, 1) },
  { id: "n2", groupId: "g1", type: "OVERTIME", title: "특근 가능 요청", body: "이번 주말 특근 가능 여부를 표시해 주세요.", createdAt: new Date(Date.now() - 3_600_000).toISOString(), readAt: null, targetDate: addDays(t, 3) },
  { id: "n3", groupId: "g1", type: "JOIN_REQUEST", title: "가입 승인 요청", body: "오세린 님이 기술지원 1팀 가입을 요청했습니다.", createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(), readAt: null },
  { id: "n4", groupId: "g1", type: "DAY_NOTE", title: "그룹 메모 수정", body: "메모가 수정되었습니다: 광주 현장 오전 9시 집결.", createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(), readAt: new Date().toISOString(), targetDate: addDays(t, 1) },
];

// Day-note entries carry a date range; like the server, each one shows on every day it covers.
type DemoNote = { id: string; text: string; assignee: string; startDate: string; endDate: string };
let dayNotes: DemoNote[] = [
  { id: "d1", text: "광주 현장 오전 9시 집결. 타겟 장비는 전날 반출 확인 부탁드립니다.", assignee: "", startDate: addDays(t, 1), endDate: addDays(t, 2) },
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function demoFetch<T>(method: string, url: string, body: unknown): Promise<T> {
  await delay(150);
  const [path, qs = ""] = url.split("?");
  const q = Object.fromEntries(qs.split("&").filter(Boolean).map((p) => p.split("=").map(decodeURIComponent)));
  const b = (body ?? {}) as Record<string, unknown>;
  const out = (v: unknown) => JSON.parse(JSON.stringify(v)) as T;

  if (path === "/api/auth/me") return out({ user: me });
  if (path === "/api/auth/app-native-signin") return out({ sessionToken: "demo", cookieName: "demo", pending: false });
  if (path === "/api/groups") return out([group]);

  if (path === "/api/events" && method === "GET") {
    const start = q.start ? toKey(q.start) : null;
    const end = q.end ? toKey(q.end) : null;
    return out(
      events.filter((e) => (!end || toKey(e.startDate) <= end) && (!start || toKey(e.endDate) >= start)),
    );
  }
  // Demo stand-in for the AI reading: the rule parser, shaped like the server's answer.
  if (path === "/api/events/parse" && method === "POST") {
    const d = parseQuickAdd(String(b.text ?? ""), String(b.date ?? todayKey()), group.members.map((m) => m.nickname ?? m.user.name ?? ""));
    const leave = d.category === "ATTENDANCE";
    return out({
      draft: { status: "ok", category: d.category, leaveType: leave ? d.title : null, title: d.title, startDate: d.start, endDate: d.end, time: d.time, people: d.people, unknownPeople: [], detail: "", note: "" },
    });
  }
  if (path === "/api/events" && method === "POST") {
    if (b.isOvertimeOnly) {
      const key = toKey(String(b.startDate));
      events = events.filter((e) => !(e.isOvertimeOnly && e.creatorId === me.id && covers(e, key)));
      const created = ev(0, 1, {
        title: b.overtimeAvailable ? "특근 가능" : "특근 불가능",
        isOvertimeOnly: true,
        overtimeAvailable: Boolean(b.overtimeAvailable),
        personnel: me.name,
        color: b.overtimeAvailable ? "#F59E0B" : "#EF4444",
        startDate: String(b.startDate),
        endDate: String(b.endDate),
      });
      events.push(created);
      return out(created);
    }
    const created = ev(0, 1, { ...(b as Partial<CalEvent>), startDate: String(b.startDate), endDate: String(b.endDate) });
    events.push(created);
    return out(created);
  }
  const eventMatch = path.match(/^\/api\/events\/([^/]+)$/);
  if (eventMatch) {
    const id = eventMatch[1];
    if (method === "DELETE") {
      events = events.filter((e) => e.id !== id);
      return out({ success: true });
    }
    events = events.map((e) => (e.id === id ? { ...e, ...(b as Partial<CalEvent>) } : e));
    return out(events.find((e) => e.id === id));
  }
  if (path === "/api/overtime-status" && method === "DELETE") {
    events = events.filter((e) => !(e.isOvertimeOnly && e.creatorId === me.id && covers(e, q.date)));
    return out({ success: true });
  }
  if (path === "/api/day-notes") {
    if (method === "PUT") {
      const date = String(b.date);
      const entries = ((b.entries as DemoNote[]) ?? []).map((e) => ({ ...e, startDate: e.startDate || date, endDate: e.endDate || date }));
      // Replace what this day showed (by id) with the edited list, keeping other days' entries.
      const shown = new Set(dayNotes.filter((n) => n.startDate <= date && n.endDate >= date).map((n) => n.id));
      dayNotes = [...dayNotes.filter((n) => !shown.has(n.id) && !entries.some((e) => e.id === n.id)), ...entries];
      return out({ success: true });
    }
    if (q.start && q.end) {
      const dates = new Set<string>();
      for (const n of dayNotes) for (let d = n.startDate; d <= n.endDate; d = addDays(d, 1)) if (d >= q.start && d <= q.end) dates.add(d);
      return out({ notes: [...dates].map((date) => ({ id: `d-${date}`, date, items: dayNotes.filter((n) => n.startDate <= date && n.endDate >= date) })), canEdit: true });
    }
    const items = dayNotes.filter((n) => n.startDate <= q.date && n.endDate >= q.date);
    return out({
      note: items.length ? { id: `d-${q.date}`, date: q.date, content: items.map((i) => i.text).join("\n"), items, updatedAt: new Date().toISOString() } : null,
      canEdit: true,
    });
  }
  if (path === "/api/personal-notes") {
    if (method === "PUT") {
      personalNotes[String(b.date)] = (b.items as { id: string; text: string }[]) ?? [];
      return out({ note: null });
    }
    const items = personalNotes[q.date] ?? [];
    return out({ note: items.length ? { id: "p1", date: q.date, items } : null });
  }
  if (path === "/api/admin/holidays") {
    if (method === "POST") {
      holidays = [...holidays.filter((h) => h.date !== b.date), { id: `h${seq++}`, date: String(b.date), name: String(b.name || (b.type === "holiday" ? "회사 휴일" : "대체 근무일")), type: b.type as CustomHoliday["type"] }];
      holidays.sort((a, c) => a.date.localeCompare(c.date));
      return out({ ok: true });
    }
    if (method === "DELETE") {
      holidays = holidays.filter((h) => h.id !== b.id);
      return out({ ok: true });
    }
    return out(holidays);
  }
  if (path === "/api/admin/pending") return out(pendingUsers);
  if (path === "/api/admin/approve") {
    pendingUsers = pendingUsers.filter((u) => u.id !== b.userId);
    return out({ ok: true });
  }
  if (path === "/api/admin/users") {
    const users: AdminUser[] = group.members
      .filter((m) => m.status === "ACTIVE")
      .map((m) => ({ id: m.userId, name: m.user.name, email: m.user.email ?? null, employeeId: null, isOperator: m.userId === me.id, createdAt: new Date().toISOString(), groupMembers: [{ id: m.id, role: m.role, group: { id: group.id, name: group.name, leaderId: group.leaderId } }] }));
    return out(users);
  }
  if (path === "/api/admin/schedules") {
    if (method === "POST") schedules.push({ id: `s${seq++}`, groupId: String(b.groupId), message: String(b.message), dayOfWeek: String(b.dayOfWeek), timeHour: Number(b.timeHour), timeMin: Number(b.timeMin), active: true });
    else if (method === "PATCH") schedules = schedules.map((s) => (s.id === b.id ? { ...s, ...(b as Partial<NotificationSchedule>) } : s));
    else if (method === "DELETE") schedules = schedules.filter((s) => s.id !== b.id);
    return out(method === "GET" ? schedules : { ok: true });
  }
  if (path === "/api/admin/notify") return out({ ok: true, sent: group.members.length });
  if (path === "/api/admin/notify-permission") {
    group.members = group.members.map((m) => (m.id === b.memberId ? { ...m, canNotify: Boolean(b.canNotify) } : m));
    return out({ ok: true });
  }
  const memberMatch = path.match(/^\/api\/groups\/[^/]+\/members\/([^/]+)$/);
  if (memberMatch) {
    const id = memberMatch[1];
    if (b.status === "REJECTED") group.members = group.members.filter((m) => m.id !== id);
    else group.members = group.members.map((m) => (m.id === id ? { ...m, ...(b as object) } : m));
    return out({ success: true });
  }
  if (/^\/api\/groups\/[^/]+\/invite$/.test(path)) {
    group.inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    return out({ inviteCode: group.inviteCode });
  }
  if (/^\/api\/groups\/[^/]+\/qr-invite$/.test(path)) return out({ token: "demo-qr-token", expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
  if (/^\/api\/groups\/[^/]+\/calendar-sync$/.test(path)) return out({ success: true });
  if (/^\/api\/groups\/[^/]+\/leader$/.test(path)) return out({ success: true });
  if (path === "/api/groups/join") return out({ success: true, groupId: "g2", groupName: "데모 그룹", pending: true });
  if (/^\/api\/groups\/[^/]+$/.test(path) && method === "PATCH") {
    Object.assign(group, b);
    return out(group);
  }
  if (path === "/api/notifications") {
    return out({ items: notifications, unreadCount: notifications.filter((n) => !n.readAt).length });
  }
  if (path === "/api/notifications/read-all") {
    notifications = notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
    return out({ count: notifications.length });
  }
  const readMatch = path.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (readMatch) {
    notifications = notifications.map((n) => (n.id === readMatch[1] ? { ...n, readAt: new Date().toISOString() } : n));
    return out({ success: true });
  }
  if (path === "/api/push/mobile-token") return out({ ok: true });
  return out({});
}
