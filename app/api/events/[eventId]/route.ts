import { auth } from "@/lib/auth";
import { isLeaderRole } from "@/lib/groupPermissions";
import { prisma } from "@/lib/prisma";
import { eventBus } from "@/lib/eventBus";
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

  let canEdit = event.creatorId === session.user.id;
  if (!canEdit && event.groupId) {
    const group = await prisma.group.findUnique({ where: { id: event.groupId } });
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: event.groupId, userId: session.user.id } },
      select: { role: true, status: true },
    });
    canEdit =
      group?.leaderId === session.user.id ||
      (member?.status === "ACTIVE" && isLeaderRole(member.role));
  }
  if (!canEdit) {
    return Response.json({ error: "수정 권한이 없습니다" }, { status: 403 });
  }

  const body = await request.json();
  const {
    title,
    description,
    startDate,
    endDate,
    allDay,
    color,
    overtimeAvailable,
    isOvertimeOnly,
    personnel,
    equipment,
  } = body;
  const defaultPersonnel = await resolveDefaultPersonnel(event.creatorId, event.groupId);

  const updateData = {
    ...(title?.trim() && { title: title.trim() }),
    ...(description !== undefined && { description: description?.trim() }),
    ...(startDate && { startDate: new Date(startDate) }),
    ...(endDate && { endDate: new Date(endDate) }),
    ...(allDay !== undefined && { allDay }),
    ...(color && { color }),
    ...(overtimeAvailable !== undefined && { overtimeAvailable }),
    ...(isOvertimeOnly !== undefined && { isOvertimeOnly }),
    ...(personnel !== undefined && { personnel: personnel?.trim() || defaultPersonnel }),
    ...(equipment !== undefined && { equipment: equipment?.trim() || null }),
  };

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: updateData as never,
    include: {
      creator: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  if (updated.groupId) eventBus.notify(updated.groupId);
  return Response.json(updated);
}

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
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: event.groupId, userId: session.user.id } },
      select: { role: true, status: true },
    });
    canDelete =
      group?.leaderId === session.user.id ||
      (member?.status === "ACTIVE" && isLeaderRole(member.role));
  }
  if (!canDelete) {
    return Response.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
  }

  await prisma.event.delete({ where: { id: eventId } });

  if (event.groupId) eventBus.notify(event.groupId);
  return Response.json({ success: true });
}
