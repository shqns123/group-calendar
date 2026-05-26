import { auth } from "@/lib/auth";
import { isLeaderRole, isObserverRole } from "@/lib/groupPermissions";
import { prisma } from "@/lib/prisma";
import { eventBus } from "@/lib/eventBus";
import {
  deleteEventNotifications,
  syncEventNotifications,
} from "@/lib/notificationStore";
import { parseEventDateInput } from "@/lib/seoulTime";
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
      "작성자"
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  return user?.name?.trim() || user?.email?.split("@")[0] || "작성자";
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
  if (event.groupId) {
    const group = await prisma.group.findUnique({ where: { id: event.groupId } });
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: event.groupId, userId: session.user.id } },
      select: { role: true, status: true },
    });
    if (member?.status === "ACTIVE" && isObserverRole(member.role)) {
      return Response.json({ error: "옵저버는 그룹 일정을 열람만 할 수 있습니다" }, { status: 403 });
    }
    if (!canEdit) {
      canEdit =
        group?.leaderId === session.user.id ||
        (member?.status === "ACTIVE" && isLeaderRole(member.role));
    }
  }
  if (!canEdit) {
    return Response.json({ error: "수정 권한이 없습니다" }, { status: 403 });
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
    personnel,
    equipment,
  } = body;
  const eventCategory =
    category === undefined
      ? event.category
      : category === "ATTENDANCE"
        ? "ATTENDANCE"
        : "BUSINESS_TRIP";
  const defaultPersonnel = await resolveDefaultPersonnel(event.creatorId, event.groupId);

  const updateData = {
    ...(category !== undefined && { category: eventCategory }),
    ...(title?.trim() && { title: title.trim() }),
    ...(description !== undefined && { description: description?.trim() }),
    ...(startDate && { startDate: parseEventDateInput(startDate) }),
    ...(endDate && { endDate: parseEventDateInput(endDate) }),
    ...(allDay !== undefined && { allDay }),
    ...(color && { color }),
    ...(overtimeAvailable !== undefined && { overtimeAvailable }),
    ...(isOvertimeOnly !== undefined && { isOvertimeOnly }),
    ...(personnel !== undefined && { personnel: personnel?.trim() || defaultPersonnel }),
    ...(eventCategory === "ATTENDANCE"
      ? { equipment: null }
      : equipment !== undefined
        ? { equipment: equipment?.trim() || null }
        : {}),
  };

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: updateData as never,
    include: {
      creator: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  await syncEventNotifications({
    id: updated.id,
    groupId: updated.groupId,
    creatorId: updated.creatorId,
    title: updated.title,
    personnel: updated.personnel,
    overtimeAvailable: updated.overtimeAvailable,
    isOvertimeOnly: updated.isOvertimeOnly,
    startDate: updated.startDate,
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
  if (event.groupId) {
    const group = await prisma.group.findUnique({ where: { id: event.groupId } });
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: event.groupId, userId: session.user.id } },
      select: { role: true, status: true },
    });
    if (member?.status === "ACTIVE" && isObserverRole(member.role)) {
      return Response.json({ error: "옵저버는 그룹 일정을 열람만 할 수 있습니다" }, { status: 403 });
    }
    if (!canDelete) {
      canDelete =
        group?.leaderId === session.user.id ||
        (member?.status === "ACTIVE" && isLeaderRole(member.role));
    }
  }
  if (!canDelete) {
    return Response.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
  }

  await prisma.event.delete({ where: { id: eventId } });
  await deleteEventNotifications(eventId);

  if (event.groupId) eventBus.notify(event.groupId);
  return Response.json({ success: true });
}
