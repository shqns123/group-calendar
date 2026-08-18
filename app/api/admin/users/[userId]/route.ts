import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (!me?.isOperator) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const groupDataAction = new URL(_req.url).searchParams.get("groupDataAction") ?? "delete";

  if (userId === session.user.id) {
    return Response.json({ error: "자신의 계정은 삭제할 수 없습니다" }, { status: 400 });
  }
  if (groupDataAction !== "delete" && groupDataAction !== "preserve") {
    return Response.json({ error: "유효하지 않은 데이터 처리 방식입니다" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!targetUser) {
    return Response.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Personal calendar data is always permanently deleted with its owner.
      await tx.personalDayNote.deleteMany({ where: { userId } });
      await tx.event.deleteMany({ where: { creatorId: userId, groupId: null } });

      // A deleted group leader must not leave their group without an administrator.
      await tx.group.updateMany({ where: { leaderId: userId }, data: { leaderId: session.user.id } });

      if (groupDataAction === "preserve") {
        const archivedUser = await tx.user.create({
          data: {
            name: targetUser.name,
            status: "DELETED",
          },
          select: { id: true },
        });

        await tx.event.updateMany({
          where: { creatorId: userId, groupId: { not: null } },
          data: { creatorId: archivedUser.id },
        });
        await tx.groupDayNote.updateMany({ where: { createdById: userId }, data: { createdById: archivedUser.id } });
        await tx.groupDayNote.updateMany({ where: { updatedById: userId }, data: { updatedById: archivedUser.id } });
        await tx.qrInviteToken.updateMany({ where: { createdById: userId }, data: { createdById: archivedUser.id } });
      } else {
        await tx.event.deleteMany({ where: { creatorId: userId, groupId: { not: null } } });
      }

      await tx.user.delete({ where: { id: userId } });
    });
  } catch {
    return Response.json({ error: "사용자 삭제 중 오류가 발생했습니다" }, { status: 500 });
  }

  return Response.json({ success: true });
}
