import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageGroupNotifications } from "@/lib/groupPermissions";
import { sendPushToUser } from "@/lib/webpush";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId, message } = await req.json();
  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  if (!groupId || !trimmedMessage || trimmedMessage.length > 200) {
    return Response.json({ error: "groupId and message required" }, { status: 400 });
  }

  if (!(await canManageGroupNotifications(session.user.id, groupId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { status: "ACTIVE" },
        include: { user: { include: { pushSubscriptions: true } } },
      },
    },
  });

  if (!group) return Response.json({ error: "Group not found" }, { status: 404 });

  const allSubs = group.members.flatMap((m) => m.user.pushSubscriptions);

  if (allSubs.length > 0) {
    await sendPushToUser(allSubs, {
      title: group.name,
      body: trimmedMessage,
      url: "/",
    });
  }

  return Response.json({ ok: true, sent: allSubs.length });
}
