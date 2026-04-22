import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function canManageHolidays(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isOperator: true } });
  if (user?.isOperator) return true;
  const leaderGroup = await prisma.group.findFirst({ where: { leaderId: userId } });
  if (leaderGroup) return true;
  const canNotifyMember = await prisma.groupMember.findFirst({
    where: { userId, canNotify: true, status: "ACTIVE" },
  });
  return !!canNotifyMember;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const holidays = await prisma.customHoliday.findMany({
    orderBy: { date: "asc" },
  });
  return Response.json(holidays);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { date, name, type } = await req.json();
  if (!date || !["holiday", "workday"].includes(type)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!(await canManageHolidays(session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const finalName = name?.trim() || (type === "holiday" ? "회사 휴일" : "대체 근무일");

  const holiday = await prisma.customHoliday.upsert({
    where: { date },
    create: { date, name: finalName, type },
    update: { name: finalName, type },
  });
  return Response.json(holiday);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canManageHolidays(session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();
  await prisma.customHoliday.delete({ where: { id } });
  return Response.json({ ok: true });
}
