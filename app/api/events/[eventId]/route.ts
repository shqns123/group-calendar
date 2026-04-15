import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// 이벤트 수정
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/events/[eventId]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { eventId } = await ctx.params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return Response.json({ error: "일정을 찾을 수 없습니다" }, { status: 404 });
  }

  // 리더 또는 작성자만 수정 가능
  let canEdit = event.creatorId === session.user.id;
  if (!canEdit && event.groupId) {
    const group = await prisma.group.findUnique({ where: { id: event.groupId } });
    canEdit = group?.leaderId === session.user.id;
  }
  if (!canEdit) {
    return Response.json({ error: "수정 권한이 없습니다" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, startDate, endDate, allDay, color, isPrivate } = body;

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(title?.trim() && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(allDay !== undefined && { allDay }),
      ...(color && { color }),
      ...(isPrivate !== undefined && { isPrivate }),
    },
    include: {
      creator: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return Response.json(updated);
}

// 이벤트 삭제
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/events/[eventId]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { eventId } = await ctx.params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return Response.json({ error: "일정을 찾을 수 없습니다" }, { status: 404 });
  }

  let canDelete = event.creatorId === session.user.id;
  if (!canDelete && event.groupId) {
    const group = await prisma.group.findUnique({ where: { id: event.groupId } });
    canDelete = group?.leaderId === session.user.id;
  }
  if (!canDelete) {
    return Response.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
  }

  await prisma.event.delete({ where: { id: eventId } });

  return Response.json({ success: true });
}
