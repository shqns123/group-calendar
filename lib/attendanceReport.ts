import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "./prisma";
import { formatSeoulDateKey, formatSeoulDateTimeLabel, getSeoulDayRange } from "./seoulTime";

type AttendanceEventWithRelations = Awaited<
  ReturnType<typeof findAttendanceEvents>
>[number];

export type AttendanceReportPayload = {
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

type ReportFileResult = {
  filePath: string;
  fileName: string;
  count: number;
  payload: AttendanceReportPayload;
};

type SendAttendanceReportOptions = {
  groupId?: string;
  to?: string | null;
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
    shifted.getUTCFullYear(),
    "-",
    padDatePart(shifted.getUTCMonth() + 1),
    "-",
    padDatePart(shifted.getUTCDate()),
    "T",
    padDatePart(shifted.getUTCHours()),
    ":",
    padDatePart(shifted.getUTCMinutes()),
    ":",
    padDatePart(shifted.getUTCSeconds()),
    ".",
    padDatePart(shifted.getUTCMilliseconds(), 3),
    "+09:00",
  ].join("");
}

async function findAttendanceEvents(client: PrismaClient, groupId?: string, now = new Date()) {
  const todayRange = getSeoulDayRange(now);

  return client.event.findMany({
    where: {
      category: "ATTENDANCE",
      endDate: { gte: todayRange.start },
      ...(groupId && { groupId }),
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    include: {
      creator: { select: { id: true, name: true, email: true, employeeId: true } },
      group: { select: { id: true, name: true } },
    },
  });
}

function getExportDirectory() {
  if (process.env.NODE_ENV === "production") {
    return path.join(process.cwd(), "data", "exports");
  }

  return path.join(process.cwd(), "exports");
}

function sanitizeFileNamePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

async function getReportGroupName(
  client: PrismaClient,
  events: AttendanceEventWithRelations[],
  groupId?: string,
) {
  if (!groupId) return null;

  if (events[0]?.group?.name) return events[0].group.name;

  const group = await client.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });

  return group?.name ?? groupId;
}

function buildAttendanceReportPayload(
  events: AttendanceEventWithRelations[],
  now: Date,
): AttendanceReportPayload {
  return {
    exportedAt: asSeoulIsoString(now),
    reportDate: formatSeoulDateKey(now),
    source: "group-calendar Event.category=ATTENDANCE timezone=Asia/Seoul",
    count: events.length,
    events: events.map((event) => ({
      id: event.id,
      category: event.category,
      title: event.title,
      description: event.description,
      startDate: asSeoulIsoString(event.startDate),
      endDate: asSeoulIsoString(event.endDate),
      allDay: event.allDay,
      color: event.color,
      overtimeAvailable: event.overtimeAvailable,
      isOvertimeOnly: event.isOvertimeOnly,
      equipmentOnly: event.equipmentOnly,
      personnel: parseJsonMaybe(event.personnel),
      equipment: parseJsonMaybe(event.equipment),
      creator: event.creator,
      group: event.group,
      createdAt: asSeoulIsoString(event.createdAt),
      updatedAt: asSeoulIsoString(event.updatedAt),
    })),
  };
}

export async function writeAttendanceReportJson(
  client: PrismaClient = prisma,
  now = new Date(),
  groupId?: string,
): Promise<ReportFileResult> {
  const events = await findAttendanceEvents(client, groupId, now);
  const payload = buildAttendanceReportPayload(events, now);
  const groupName = await getReportGroupName(client, events, groupId);
  const fileName = groupName
    ? `${sanitizeFileNamePart(groupName)} ${payload.reportDate}.json`
    : `${payload.reportDate}.json`;
  const filePath = path.join(getExportDirectory(), fileName);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return { filePath, fileName, count: payload.count, payload };
}

function getMailRecipients(to?: string | null) {
  return to || process.env.ATTENDANCE_REPORT_TO || process.env.MAIL_TO || process.env.OPERATOR_EMAIL || "";
}

function getMailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || process.env.OPERATOR_EMAIL || "";
}

function getSmtpPort() {
  const parsed = Number(process.env.SMTP_PORT || "587");
  return Number.isInteger(parsed) ? parsed : 587;
}

function getSmtpSecure(port: number) {
  if (process.env.SMTP_SECURE) {
    return process.env.SMTP_SECURE.toLowerCase() === "true";
  }

  return port === 465;
}

function isGmailProvider() {
  return process.env.MAIL_PROVIDER?.toLowerCase() === "gmail";
}

function getSmtpHost() {
  if (process.env.SMTP_HOST) return process.env.SMTP_HOST;
  if (isGmailProvider()) return "smtp.gmail.com";
  return null;
}

function createTransporter() {
  const host = getSmtpHost();
  if (!host) return null;

  const port = getSmtpPort();
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: getSmtpSecure(port),
    auth: user || pass ? { user, pass } : undefined,
  });
}

export async function sendDailyAttendanceReport(now = new Date(), options: SendAttendanceReportOptions = {}) {
  const report = await writeAttendanceReportJson(prisma, now, options.groupId);
  const transporter = createTransporter();
  const to = getMailRecipients(options.to);
  const from = getMailFrom();

  if (!transporter || !to || !from) {
    console.warn(
      "[attendance-report] skipped email delivery because SMTP_HOST, sender, or recipient is missing",
    );
    return { ...report, sent: false };
  }

  await transporter.sendMail({
    from,
    to,
    subject: `[근태 일정] ${report.payload.reportDate} JSON 파일`,
    text: [
      `${formatSeoulDateTimeLabel(now)} 기준으로 등록된 근태 일정 ${report.count}건을 첨부합니다.`,
      "",
      "첨부 파일을 확인해주세요.",
    ].join("\n"),
    attachments: [
      {
        filename: report.fileName,
        path: report.filePath,
        contentType: "application/json",
      },
    ],
  });

  console.info(`[attendance-report] sent ${report.fileName} (${report.count} events) to ${to}`);
  return { ...report, sent: true };
}
