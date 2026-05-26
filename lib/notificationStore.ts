import { prisma } from "@/lib/prisma";
import {
  buildEventNotificationBody,
  buildOvertimeNotificationBody,
  getEventNotificationNames,
  type NotificationType,
} from "@/lib/notifications";
import { formatSeoulMonthDayWeekdayLabel, toSeoulDateInput } from "@/lib/seoulTime";

type EventNotificationPayload = {
  id: string;
  groupId: string | null;
  creatorId: string;
  title: string;
  personnel: string | null;
  overtimeAvailable: boolean;
  startDate: Date;
};

type JoinRequestPayload = {
  id: string;
  groupId: string;
  userId: string;
};

async function resolveActorName(userId: string, groupId?: string | null) {
  if (groupId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: {
        nickname: true,
        user: { select: { name: true, email: true } },
      },
    });

    const memberName =
      member?.nickname?.trim() ||
      member?.user.name?.trim() ||
      member?.user.email?.split("@")[0];
    if (memberName) return memberName;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  return user?.name?.trim() || user?.email?.split("@")[0] || "사용자";
}

function getSourceKey(type: NotificationType, entityId: string) {
  return `${type}:${entityId}`;
}

async function upsertNotification(data: {
  sourceKey: string;
  groupId: string;
  type: NotificationType;
  actorUserId?: string | null;
  eventId?: string | null;
  groupMemberId?: string | null;
  targetDate?: string | null;
  title: string;
  body: string;
}) {
  return prisma.notification.upsert({
    where: { sourceKey: data.sourceKey },
    update: {
      groupId: data.groupId,
      type: data.type,
      actorUserId: data.actorUserId ?? null,
      eventId: data.eventId ?? null,
      groupMemberId: data.groupMemberId ?? null,
      targetDate: data.targetDate ?? null,
      title: data.title,
      body: data.body,
      resolvedAt: null,
    },
    create: {
      groupId: data.groupId,
      type: data.type,
      actorUserId: data.actorUserId ?? null,
      eventId: data.eventId ?? null,
      groupMemberId: data.groupMemberId ?? null,
      targetDate: data.targetDate ?? null,
      sourceKey: data.sourceKey,
      title: data.title,
      body: data.body,
    },
  });
}

export async function syncEventNotifications(event: EventNotificationPayload) {
  if (!event.groupId) return;

  const actorName = await resolveActorName(event.creatorId, event.groupId);
  const names = getEventNotificationNames({
    personnel: event.personnel,
    actorName,
  });

  await upsertNotification({
    sourceKey: getSourceKey("EVENT_CREATED", event.id),
    groupId: event.groupId,
    type: "EVENT_CREATED",
    actorUserId: event.creatorId,
    eventId: event.id,
    title: "일정 등록",
    body: buildEventNotificationBody({ title: event.title, names }),
  });

  if (event.overtimeAvailable) {
    await upsertNotification({
      sourceKey: getSourceKey("OVERTIME_AVAILABLE", event.id),
      groupId: event.groupId,
      type: "OVERTIME_AVAILABLE",
      actorUserId: event.creatorId,
      eventId: event.id,
      targetDate: toSeoulDateInput(event.startDate),
      title: "특근 가능",
      body: buildOvertimeNotificationBody({
        actorName,
        dateLabel: formatSeoulMonthDayWeekdayLabel(event.startDate),
      }),
    });
  } else {
    await prisma.notification.deleteMany({
      where: { sourceKey: getSourceKey("OVERTIME_AVAILABLE", event.id) },
    });
  }
}

export async function deleteEventNotifications(eventId: string) {
  await prisma.notification.deleteMany({
    where: {
      sourceKey: {
        in: [
          getSourceKey("EVENT_CREATED", eventId),
          getSourceKey("OVERTIME_AVAILABLE", eventId),
        ],
      },
    },
  });
}

export async function createJoinRequestNotification(input: JoinRequestPayload) {
  const actorName = await resolveActorName(input.userId, input.groupId);

  await upsertNotification({
    sourceKey: getSourceKey("JOIN_REQUEST_PENDING", input.id),
    groupId: input.groupId,
    type: "JOIN_REQUEST_PENDING",
    actorUserId: input.userId,
    groupMemberId: input.id,
    title: "승인 대기",
    body: `${actorName}님이 그룹 참가를 요청했습니다.`,
  });
}

export async function resolveJoinRequestNotification(groupMemberId: string) {
  await prisma.notification.updateMany({
    where: { sourceKey: getSourceKey("JOIN_REQUEST_PENDING", groupMemberId) },
    data: { resolvedAt: new Date() },
  });
}

export async function listNotificationsForUser(input: {
  userId: string;
  selectedGroupId?: string | null;
  includePendingAcrossGroups?: boolean;
}) {
  const { userId, selectedGroupId, includePendingAcrossGroups = false } = input;

  const visibleGroupIds = new Set<string>();

  if (selectedGroupId) {
    visibleGroupIds.add(selectedGroupId);
  }

  if (includePendingAcrossGroups) {
    const accessibleGroups = await prisma.group.findMany({
      where: {
        OR: [
          { leaderId: userId },
          { members: { some: { userId, status: "ACTIVE" } } },
        ],
      },
      select: { id: true },
    });
    for (const group of accessibleGroups) {
      visibleGroupIds.add(group.id);
    }
  }

  if (visibleGroupIds.size === 0) {
    return [];
  }

  return prisma.notification.findMany({
    where: {
      groupId: { in: [...visibleGroupIds] },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function markNotificationRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markNotificationsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) {
    return { count: 0 };
  }

  return prisma.notification.updateMany({
    where: { id: { in: notificationIds } },
    data: { readAt: new Date() },
  });
}
