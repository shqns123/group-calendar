import { auth } from "@/lib/auth";
import { canViewNotificationBell } from "@/lib/notifications";
import { listNotificationsForUser } from "@/lib/notificationStore";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
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
    return Response.json({ items: [], unreadCount: 0 });
  }

  const items = await listNotificationsForUser({
    userId: session.user.id,
    selectedGroupId: groupId,
    includePendingAcrossGroups: user?.isOperator ?? false,
  });

  return Response.json({
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
      resolvedAt: item.resolvedAt?.toISOString() ?? null,
    })),
    unreadCount: items.filter((item) => item.readAt === null).length,
  });
}
