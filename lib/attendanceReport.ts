import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "./prisma";
import { formatSeoulDateKey, getSeoulDayRange } from "./seoulTime";

type AttendanceEventWithRelations = Awaited<ReturnType<typeof findAttendanceEvents>>[number];

export type CalendarPayload = {
  exportedAt: string;
  reportDate: string;
  source: string;
  count: number;
  events: Array<{
    id: string;
    category: string;
    title: string;
    description: string | null;
    startDate: string;
    endDate: string;
    allDay: boolean;
    color: string;
    overtimeAvailable: boolean;
    isOvertimeOnly: boolean;
    equipmentOnly: boolean;
    personnel: unknown;
    equipment: unknown;
    creator: AttendanceEventWithRelations["creator"];
    group: AttendanceEventWithRelations["group"];
    createdAt: string;
    updatedAt: string;
  }>;
};

export type CalendarFileResult = {
  filePath: string;
  fileName: string;
  count: number;
  payload: CalendarPayload;
};

function parseJsonMaybe(value: string | null) {
  if (!value?.trim()) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function padDatePart(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function asSeoulIsoString(value: Date) {
  const shifted = new Date(value.getTime() + 9 * 60 * 60 * 1000);
  return [
    shifted.getUTCFullYear(), "-", padDatePart(shifted.getUTCMonth() + 1), "-", padDatePart(shifted.getUTCDate()),
    "T", padDatePart(shifted.getUTCHours()), ":", padDatePart(shifted.getUTCMinutes()), ":", padDatePart(shifted.getUTCSeconds()),
    ".", padDatePart(shifted.getUTCMilliseconds(), 3), "+09:00",
  ].join("");
}

async function findAttendanceEvents(client: PrismaClient, groupId: string, now = new Date()) {
  const todayRange = getSeoulDayRange(now);
  return client.event.findMany({
    where: { category: "ATTENDANCE", groupId, endDate: { gte: todayRange.start } },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    include: {
      creator: { select: { id: true, name: true, email: true, employeeId: true } },
      group: { select: { id: true, name: true } },
    },
  });
}

function getExportDirectory() {
  return process.env.NODE_ENV === "production"
    ? path.join(process.cwd(), "data", "exports")
    : path.join(process.cwd(), "exports");
}

function sanitizeFileNamePart(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/\s+/g, " ").trim() || "unnamed-group";
}

function buildCalendarPayload(events: AttendanceEventWithRelations[], now: Date): CalendarPayload {
  return {
    exportedAt: asSeoulIsoString(now),
    reportDate: formatSeoulDateKey(now),
    source: "group-calendar Event.category=ATTENDANCE timezone=Asia/Seoul",
    count: events.length,
    events: events.map((event) => ({
      id: event.id, category: event.category, title: event.title, description: event.description,
      startDate: asSeoulIsoString(event.startDate), endDate: asSeoulIsoString(event.endDate), allDay: event.allDay,
      color: event.color, overtimeAvailable: event.overtimeAvailable, isOvertimeOnly: event.isOvertimeOnly,
      equipmentOnly: event.equipmentOnly, personnel: parseJsonMaybe(event.personnel), equipment: parseJsonMaybe(event.equipment),
      creator: event.creator, group: event.group, createdAt: asSeoulIsoString(event.createdAt), updatedAt: asSeoulIsoString(event.updatedAt),
    })),
  };
}

export async function writeGroupCalendarJson(
  groupId: string,
  client: PrismaClient = prisma,
  now = new Date(),
): Promise<CalendarFileResult> {
  const group = await client.group.findUnique({ where: { id: groupId }, select: { name: true } });
  if (!group) throw new Error("그룹을 찾을 수 없습니다.");

  const events = await findAttendanceEvents(client, groupId, now);
  const payload = buildCalendarPayload(events, now);
  const fileName = `${sanitizeFileNamePart(group.name)} calendar.json`;
  const filePath = path.join(getExportDirectory(), fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { filePath, fileName, count: payload.count, payload };
}
