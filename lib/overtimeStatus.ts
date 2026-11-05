import "server-only";

import { prisma } from "./prisma";
import { eventBus } from "./eventBus";
import { deleteEventNotifications, syncEventNotifications } from "./notificationStore";
import { addSeoulDays, parseSeoulDateInput } from "./seoulTime";

type StatusScope = {
  userId: string;
  groupId: string | null;
  dateKey: string;
};

function getStatusWhere({ userId, groupId, dateKey }: StatusScope) {
  const start = parseSeoulDateInput(dateKey);
  const nextDay = addSeoulDays(start, 1);
  return {
    creatorId: userId,
    groupId,
    isOvertimeOnly: true,
    startDate: { lt: nextDay },
    endDate: { gte: start },
  };
}

export async function saveOvertimeStatus(
  scope: StatusScope & { available: boolean; personnel: string },
) {
  const { userId, groupId, dateKey, available, personnel } = scope;
  const date = parseSeoulDateInput(dateKey);
  const overtimeKey = `${groupId ?? "personal"}:${userId}:${dateKey}`;
  const title = groupId
    ? available ? "특근 가능" : "특근 불가능"
    : available ? "특근 근무" : "특근 미근무";

  await prisma.event.upsert({
    where: { overtimeKey },
    create: {
      overtimeKey,
      creatorId: userId,
      groupId,
      category: "BUSINESS_TRIP",
      title,
      startDate: date,
      endDate: date,
      allDay: true,
      color: available ? "#F59E0B" : "#EF4444",
      overtimeAvailable: available,
      isOvertimeOnly: true,
      personnel,
    },
    update: {
      title,
      startDate: date,
      endDate: date,
      allDay: true,
      color: available ? "#F59E0B" : "#EF4444",
      overtimeAvailable: available,
      isOvertimeOnly: true,
    },
  });

  const event = await prisma.event.findUniqueOrThrow({
    where: { overtimeKey },
    include: {
      creator: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const duplicates = await prisma.event.findMany({
    where: { ...getStatusWhere(scope), id: { not: event.id } },
    select: { id: true },
  });
  if (duplicates.length) {
    const ids = duplicates.map((duplicate) => duplicate.id);
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
    await Promise.all(ids.map((id) => deleteEventNotifications(id)));
  }

  await syncEventNotifications(event);
  if (groupId) eventBus.notify(groupId);
  return event;
}

export async function clearOvertimeStatus(scope: StatusScope) {
  const events = await prisma.event.findMany({
    where: getStatusWhere(scope),
    select: { id: true },
  });
  if (!events.length) return;

  const ids = events.map((event) => event.id);
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteEventNotifications(id)));
  if (scope.groupId) eventBus.notify(scope.groupId);
}
