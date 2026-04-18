import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// 이벤트 목록 조회 (그룹 ID 또는 개인 일정)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  // 날짜 범위: 해당 기간에 겹치는 모든 일정 (시작이 end 이전 AND 종료가 start 이후)
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
    // 그룹 멤버 확인
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: session.user.id },
      },
    });
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    const isAdmin = group?.leaderId === session.user.id;
    const isLeader = isAdmin || member?.role === "그룹장" || member?.role === "파트장";

    if (!isAdmin && (!member || member.status !== "ACTIVE")) {
      return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: {
        groupId,
        ...dateFilter,
        // 관리자/리더는 모든 이벤트, 멤버는 공개 이벤트 + 자신의 비공개 이벤트
        OR: isLeader
          ? undefined
          : [{ isPrivate: false }, { creatorId: session.user.id }],
      },
      include: {
        creator: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { startDate: "asc" },
    });

    // 그룹 멤버의 닉네임 맵 생성
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true } } },
    });
    const nicknameMap = Object.fromEntries(
      members.map((m) => [m.userId, m.nickname])
    );

    const eventsWithNickname = events.map((e) => ({
      ...e,
      creatorNickname: nicknameMap[e.creatorId] || null,
    }));

    return Response.json(eventsWithNickname);
  } else {
    // 개인 일정 (그룹 없는 것)
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
}

// 이벤트 생성
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, startDate, endDate, allDay, color, isPrivate, overtimeAvailable, isOvertimeOnly, groupId } = body;

  if (!title?.trim()) {
    return Response.json({ error: "제목은 필수입니다" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return Response.json({ error: "날짜는 필수입니다" }, { status: 400 });
  }

  if (groupId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
    });
    if (!member) {
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
      creatorId: session.user.id,
      groupId: groupId || null,
    },
    include: {
      creator: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return Response.json(event, { status: 201 });
}
