import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function canManageSchedules(userId: string, groupId: string): Promise<boolean> {
  const leader = await prisma.group.findFirst({ where: { id: groupId, leaderId: userId } });
  if (leader) return true;
  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId, canNotify: true, status: "ACTIVE" },
  });
  return !!member;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  if (!groupId) return Response.json({ error: "groupId required" }, { status: 400 });

  if (!(await canManageSchedules(session.user.id, groupId))) {
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
  if (!groupId || !message || !dayOfWeek) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!(await canManageSchedules(session.user.id, groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const schedule = await prisma.notificationSchedule.create({
    data: { groupId, message, dayOfWeek, timeHour: timeHour ?? 9, timeMin: timeMin ?? 0 },
  });
  return Response.json(schedule);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, active, message, dayOfWeek, timeHour, timeMin } = await req.json();
  const schedule = await prisma.notificationSchedule.findUnique({ where: { id } });
  if (!schedule || !(await canManageSchedules(session.user.id, schedule.groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (active !== undefined) data.active = active;
  if (message !== undefined) data.message = message;
  if (dayOfWeek !== undefined) data.dayOfWeek = dayOfWeek;
  if (timeHour !== undefined) data.timeHour = timeHour;
  if (timeMin !== undefined) data.timeMin = timeMin;

  const updated = await prisma.notificationSchedule.update({ where: { id }, data });
  return Response.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const schedule = await prisma.notificationSchedule.findUnique({ where: { id } });
  if (!schedule || !(await canManageSchedules(session.user.id, schedule.groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.notificationSchedule.delete({ where: { id } });
  return Response.json({ ok: true });
}
