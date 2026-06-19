import { auth } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/notificationStore";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const notificationIds = Array.isArray(body.notificationIds)
    ? body.notificationIds.filter((value: unknown): value is string => typeof value === "string")
    : [];

  const notifications = await prisma.notification.findMany({
    where: { id: { in: notificationIds } },
    select: { id: true, groupId: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isOperator: true },
  });

  const allowedIds: string[] = [];
  for (const notification of notifications) {
    if (user?.isOperator) {
      allowedIds.push(notification.id);
      continue;
    }

    const membership = await prisma.group.findFirst({
      where: {
        id: notification.groupId,
        OR: [
          { leaderId: session.user.id },
          { members: { some: { userId: session.user.id, status: "ACTIVE" } } },
        ],
      },
      select: { id: true },
    });

    if (membership) {
      allowedIds.push(notification.id);
    }
  }

  const result = await markNotificationsRead(allowedIds);
  return Response.json({ count: result.count });
}
