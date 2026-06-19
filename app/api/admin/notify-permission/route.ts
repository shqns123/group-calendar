import { auth } from "@/lib/auth";
import { isObserverRole } from "@/lib/groupPermissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId, canNotify } = await req.json();

  const member = await prisma.groupMember.findUnique({
    where: { id: memberId },
    include: { group: true },
  });

  if (!member || member.group.leaderId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (canNotify && isObserverRole(member.role)) {
    return Response.json({ error: "옵저버에게는 알림 권한을 부여할 수 없습니다" }, { status: 400 });
  }

  const updated = await prisma.groupMember.update({
    where: { id: memberId },
    data: { canNotify },
  });

  return Response.json(updated);
}
