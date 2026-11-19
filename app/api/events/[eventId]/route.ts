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

/**
 * Who may change or delete an event. Returns an error response, or null when allowed.
 * A group event needs an ACTIVE membership even for its creator, so someone removed from
 * the group can no longer edit or delete what they wrote there; the group's owner always can.
 */
async function denyEventWrite(
  event: { creatorId: string; groupId: string | null },
  userId: string,
  action: "수정" | "삭제",
) {
  const denied = Response.json({ error: `${action} 권한이 없습니다` }, { status: 403 });
  if (!event.groupId) return event.creatorId === userId ? null : denied;

  const [group, member] = await Promise.all([
    prisma.group.findUnique({ where: { id: event.groupId }, select: { leaderId: true } }),
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: event.groupId, userId } },
      select: { role: true, status: true },
    }),
  ]);
  const activeRole = member?.status === "ACTIVE" ? member.role : null;
  if (activeRole && isObserverRole(activeRole)) {
    return Response.json({ error: "옵저버는 그룹 일정을 열람만 할 수 있습니다" }, { status: 403 });
  }
  const allowed =
    group?.leaderId === userId ||
    (activeRole !== null && (event.creatorId === userId || isLeaderRole(activeRole)));
  return allowed ? null : denied;
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

  const editDenied = await denyEventWrite(event, session.user.id, "수정");
  if (editDenied) return editDenied;

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
    equipmentOnly,
    personnel,
    equipment,
  } = body;
  const eventCategory =
    category === undefined
      ? event.category
      : category === "ATTENDANCE"
        ? "ATTENDANCE"
        : "BUSINESS_TRIP";
  const eventEquipmentOnly =
    eventCategory === "BUSINESS_TRIP"
      ? equipmentOnly === undefined
        ? event.equipmentOnly
        : equipmentOnly === true
      : false;
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
    ...(equipmentOnly !== undefined && { equipmentOnly: eventEquipmentOnly }),
    ...(eventEquipmentOnly
      ? { personnel: null }
      : personnel !== undefined
        ? { personnel: personnel?.trim() || defaultPersonnel }
        : {}),
    ...(eventCategory === "ATTENDANCE"
      ? { equipment: null, equipmentOnly: false }
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
    endDate: updated.endDate,
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

  const deleteDenied = await denyEventWrite(event, session.user.id, "삭제");
  if (deleteDenied) return deleteDenied;

  await prisma.event.delete({ where: { id: eventId } });
  await deleteEventNotifications(eventId);

  if (event.groupId) eventBus.notify(event.groupId);
  return Response.json({ success: true });
}
