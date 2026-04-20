import { auth } from "@/lib/auth";
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

  const updated = await prisma.groupMember.update({
    where: { id: memberId },
    data: { canNotify },
  });

  return Response.json(updated);
}
