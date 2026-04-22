import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function canManageHolidays(userId: string, groupId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isOperator: true } });
  if (user?.isOperator) return true;
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

  const holidays = await prisma.customHoliday.findMany({
    where: { groupId },
    orderBy: { date: "asc" },
  });
  return Response.json(holidays);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId, date, name, type } = await req.json();
  if (!groupId || !date || !["holiday", "workday"].includes(type)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const finalName = name?.trim() || (type === "holiday" ? "회사 휴일" : "대체 근무일");

  if (!(await canManageHolidays(session.user.id, groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const holiday = await prisma.customHoliday.upsert({
    where: { groupId_date: { groupId, date } },
    create: { groupId, date, name: finalName, type },
    update: { name: finalName, type },
  });
  return Response.json(holiday);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const holiday = await prisma.customHoliday.findUnique({ where: { id } });
  if (!holiday || !(await canManageHolidays(session.user.id, holiday.groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.customHoliday.delete({ where: { id } });
  return Response.json({ ok: true });
}
