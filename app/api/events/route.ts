import { auth } from "@/lib/auth";
import { isLeaderRole } from "@/lib/groupPermissions";
import { prisma } from "@/lib/prisma";
import { eventBus } from "@/lib/eventBus";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest } from "next/server";

async function resolveDefaultPersonnel(userId: string, groupId?: string | null) {
  if (groupId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: {
        nickname: true,
        user: { select: { name: true, email: true } },
      },
    });

    return (
      member?.nickname?.trim() ||
      member?.user.name?.trim() ||
      member?.user.email?.split("@")[0] ||
      "\uC791\uC131\uC790"
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  return user?.name?.trim() || user?.email?.split("@")[0] || "\uC791\uC131\uC790";
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  const dateFilter =
    startDate || endDate
      ? {
          AND: [
            ...(endDate ? [{ startDate: { lte: new Date(endDate) } }] : []),
            ...(startDate ? [{ endDate: { gte: new Date(startDate) } }] : []),
          ],
        }
      : {};

  if (groupId) {
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: session.user.id },
      },
    });
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    const isAdmin = group?.leaderId === session.user.id;
    const isLeader = isAdmin || (member?.status === "ACTIVE" && isLeaderRole(member.role));

    if (!isAdmin && (!member || member.status !== "ACTIVE")) {
      return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: {
        groupId,
        ...dateFilter,
        OR: isLeader ? undefined : [{ isPrivate: false }, { creatorId: session.user.id }],
      },
      include: {
        creator: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { startDate: "asc" },
    });

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true } } },
    });
    const nicknameMap = Object.fromEntries(members.map((item) => [item.userId, item.nickname]));

    const eventsWithNickname = events.map((item) => ({
      ...item,
      creatorNickname: nicknameMap[item.creatorId] || null,
    }));

    return Response.json(eventsWithNickname);
  }

  const events = await prisma.event.findMany({
    where: {
      creatorId: session.user.id,
      groupId: null,
      ...dateFilter,
    },
    orderBy: { startDate: "asc" },
  });

  return Response.json(events);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(`events:${session.user.id}`, 30, 60_000)) {
    return Response.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const body = await request.json();
  const {
    title,
    description,
    startDate,
    endDate,
    allDay,
    color,
    isPrivate,
    overtimeAvailable,
    isOvertimeOnly,
    groupId,
    personnel,
  } = body;

  if (!title?.trim()) {
    return Response.json({ error: "제목은 필수입니다." }, { status: 400 });
  }
  if (title.trim().length > 100) {
    return Response.json({ error: "제목은 100자 이하여야 합니다." }, { status: 400 });
  }
  if (description && description.trim().length > 500) {
    return Response.json({ error: "설명은 500자 이하여야 합니다." }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return Response.json({ error: "날짜는 필수입니다." }, { status: 400 });
  }
  if (isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
    return Response.json({ error: "유효하지 않은 날짜입니다." }, { status: 400 });
  }

  const defaultPersonnel = await resolveDefaultPersonnel(session.user.id, groupId);

  if (groupId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
      select: { status: true },
    });
    if (member?.status !== "ACTIVE") {
      return Response.json({ error: "그룹 멤버가 아닙니다" }, { status: 403 });
    }
  }

  const event = await prisma.event.create({
    data: {
      title: title.trim(),
      description: description?.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      allDay: allDay ?? false,
      color: color ?? "#3B82F6",
      isPrivate: isPrivate ?? false,
      overtimeAvailable: overtimeAvailable ?? false,
      isOvertimeOnly: isOvertimeOnly ?? false,
      personnel: personnel?.trim() || defaultPersonnel,
      creatorId: session.user.id,
      groupId: groupId || null,
    },
    include: {
      creator: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  if (event.groupId) eventBus.notify(event.groupId);
  return Response.json(event, { status: 201 });
}
