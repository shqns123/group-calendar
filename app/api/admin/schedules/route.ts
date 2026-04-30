import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageGroupNotifications } from "@/lib/groupPermissions";

function normalizeScheduleMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const message = value.trim();
  if (!message || message.length > 100) return null;
  return message;
}

function normalizeDayOfWeek(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const days = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  if (days.length === 0) return null;

  const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
  return uniqueDays.join(",");
}

function normalizeTimeValue(value: unknown, maxInclusive: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 0 || value > maxInclusive) return null;
  return value;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  if (!groupId) return Response.json({ error: "groupId required" }, { status: 400 });

  if (!(await canManageGroupNotifications(session.user.id, groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const schedules = await prisma.notificationSchedule.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(schedules);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId, message, dayOfWeek, timeHour, timeMin } = await req.json();
  const normalizedMessage = normalizeScheduleMessage(message);
  const normalizedDays = normalizeDayOfWeek(dayOfWeek);
  const normalizedHour = timeHour === undefined ? 9 : normalizeTimeValue(timeHour, 23);
  const normalizedMin = timeMin === undefined ? 0 : normalizeTimeValue(timeMin, 59);

  if (!groupId || !normalizedMessage || !normalizedDays || normalizedHour === null || normalizedMin === null) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!(await canManageGroupNotifications(session.user.id, groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const schedule = await prisma.notificationSchedule.create({
    data: {
      groupId,
      message: normalizedMessage,
      dayOfWeek: normalizedDays,
      timeHour: normalizedHour,
      timeMin: normalizedMin,
    },
  });
  return Response.json(schedule);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, active, message, dayOfWeek, timeHour, timeMin } = await req.json();
  const schedule = await prisma.notificationSchedule.findUnique({ where: { id } });
  if (!schedule || !(await canManageGroupNotifications(session.user.id, schedule.groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (active !== undefined) {
    if (typeof active !== "boolean") {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    data.active = active;
  }
  if (message !== undefined) {
    const normalizedMessage = normalizeScheduleMessage(message);
    if (!normalizedMessage) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    data.message = normalizedMessage;
  }
  if (dayOfWeek !== undefined) {
    const normalizedDays = normalizeDayOfWeek(dayOfWeek);
    if (!normalizedDays) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    data.dayOfWeek = normalizedDays;
  }
  if (timeHour !== undefined) {
    const normalizedHour = normalizeTimeValue(timeHour, 23);
    if (normalizedHour === null) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    data.timeHour = normalizedHour;
  }
  if (timeMin !== undefined) {
    const normalizedMin = normalizeTimeValue(timeMin, 59);
    if (normalizedMin === null) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    data.timeMin = normalizedMin;
  }

  const updated = await prisma.notificationSchedule.update({ where: { id }, data });
  return Response.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const schedule = await prisma.notificationSchedule.findUnique({ where: { id } });
  if (!schedule || !(await canManageGroupNotifications(session.user.id, schedule.groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.notificationSchedule.delete({ where: { id } });
  return Response.json({ ok: true });
}
