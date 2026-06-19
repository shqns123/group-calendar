import { auth } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notificationStore";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/notifications/[notificationId]/read">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notificationId } = await ctx.params;
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, groupId: true },
  });

  if (!notification) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isOperator: true },
  });
  if (!user?.isOperator) {
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

    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await markNotificationRead(notificationId);

  return Response.json({
    id: updated.id,
    readAt: updated.readAt?.toISOString() ?? null,
  });
}
