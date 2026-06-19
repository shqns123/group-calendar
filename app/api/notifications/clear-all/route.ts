import { auth } from "@/lib/auth";
import { deleteNotifications, listNotificationsForUser } from "@/lib/notificationStore";
import { canViewNotificationBell } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const groupId = typeof body.groupId === "string" ? body.groupId : null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isOperator: true },
  });
  const member = groupId
    ? await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: session.user.id } },
        select: { role: true, canNotify: true, status: true },
      })
    : null;

  const canView = canViewNotificationBell({
    isOperator: user?.isOperator,
    memberRole: member?.status === "ACTIVE" ? member.role : null,
    canNotify: member?.status === "ACTIVE" ? member.canNotify : false,
  });

  if (!canView) {
    return Response.json({ count: 0 });
  }

  const notifications = await listNotificationsForUser({
    userId: session.user.id,
    selectedGroupId: groupId,
    includePendingAcrossGroups: user?.isOperator ?? false,
  });

  const result = await deleteNotifications(notifications.map((item) => item.id));
  return Response.json({ count: result.count });
}
