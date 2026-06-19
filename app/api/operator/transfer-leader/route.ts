import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (!me?.isOperator) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { groupId, newLeaderId } = await req.json();
  if (!groupId || !newLeaderId) return Response.json({ error: "groupId and newLeaderId required" }, { status: 400 });

  // newLeaderId must be an active member of the group
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: newLeaderId } },
    select: { status: true },
  });
  if (member?.status !== "ACTIVE") {
    return Response.json({ error: "해당 유저는 활성 멤버가 아닙니다" }, { status: 400 });
  }

  await prisma.group.update({ where: { id: groupId }, data: { leaderId: newLeaderId } });
  return Response.json({ ok: true });
}
