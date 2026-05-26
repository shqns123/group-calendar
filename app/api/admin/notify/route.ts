import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageGroupNotifications } from "@/lib/groupPermissions";
import { sendMobilePushToTokens } from "@/lib/mobilepush";
import { filterNotifiableGroupMembers } from "@/lib/notificationRecipients";
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
        include: { user: { include: { pushSubscriptions: true, mobileDeviceTokens: true } } },
      },
    },
  });

  if (!group) return Response.json({ error: "Group not found" }, { status: 404 });

  const notifiableMembers = filterNotifiableGroupMembers(group.members);
  const allSubs = notifiableMembers.flatMap((member) => member.user.pushSubscriptions);
  const allMobileTokens = notifiableMembers.flatMap((member) =>
    member.user.mobileDeviceTokens.map((device) => device.token),
  );

  if (allSubs.length > 0) {
    await sendPushToUser(allSubs, {
      title: group.name,
      body: trimmedMessage,
      url: `/?groupId=${group.id}`,
    });
  }
  if (allMobileTokens.length > 0) {
    await sendMobilePushToTokens(allMobileTokens, {
      title: group.name,
      body: trimmedMessage,
      url: `/?groupId=${group.id}`,
    });
  }

  return Response.json({ ok: true, sent: allSubs.length + allMobileTokens.length });
}
