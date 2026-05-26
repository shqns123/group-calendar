import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { parseApiEventDate, parseRangeEndParam, parseRangeStartParam } from "@/lib/calendarDate";
import { eventBus } from "@/lib/eventBus";
import { isObserverRole } from "@/lib/groupPermissions";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";

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
      "작성자"
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  return user?.name?.trim() || user?.email?.split("@")[0] || "작성자";
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

  const parsedStartDate = startDate ? parseRangeStartParam(startDate) : null;
  const parsedEndDate = endDate ? parseRangeEndParam(endDate) : null;

  const dateFilter =
    parsedStartDate || parsedEndDate
      ? {
          AND: [
            ...(parsedEndDate ? [{ startDate: { lte: parsedEndDate } }] : []),
            ...(parsedStartDate ? [{ endDate: { gte: parsedStartDate } }] : []),
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

    if (!isAdmin && (!member || member.status !== "ACTIVE")) {
      return Response.json({ error: "그룹 접근 권한이 없습니다." }, { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: {
        groupId,
        ...dateFilter,
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
    return Response.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json();
  const {
    category,
    title,
    description,
    startDate,
    endDate,
    allDay,
    color,
    overtimeAvailable,
    isOvertimeOnly,
    groupId,
    personnel,
    equipment,
  } = body;

  const eventCategory = category === "ATTENDANCE" ? "ATTENDANCE" : "BUSINESS_TRIP";
  const isAllDayEvent = allDay ?? false;

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

  const parsedStartDate = parseApiEventDate(startDate, isAllDayEvent);
  const parsedEndDate = parseApiEventDate(endDate, isAllDayEvent);
  if (!parsedStartDate || !parsedEndDate) {
    return Response.json({ error: "유효하지 않은 날짜입니다." }, { status: 400 });
  }

  const defaultPersonnel = await resolveDefaultPersonnel(session.user.id, groupId);

  if (groupId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
      select: { status: true, role: true },
    });

    if (member?.status !== "ACTIVE") {
      return Response.json({ error: "그룹 멤버가 아닙니다." }, { status: 403 });
    }
    if (isObserverRole(member.role)) {
      return Response.json({ error: "옵저버는 그룹 일정을 조회만 할 수 있습니다." }, { status: 403 });
    }
  }

  const eventData = {
    category: eventCategory,
    title: title.trim(),
    description: description?.trim(),
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    allDay: isAllDayEvent,
    color: color ?? "#3B82F6",
    overtimeAvailable: overtimeAvailable ?? false,
    isOvertimeOnly: isOvertimeOnly ?? false,
    personnel: personnel?.trim() || defaultPersonnel,
    equipment: eventCategory === "ATTENDANCE" ? null : equipment?.trim() || null,
    creatorId: session.user.id,
    groupId: groupId || null,
  };

  const event = await prisma.event.create({
    data: eventData as never,
    include: {
      creator: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  if (event.groupId) {
    eventBus.notify(event.groupId);
  }

  return Response.json(event, { status: 201 });
}
