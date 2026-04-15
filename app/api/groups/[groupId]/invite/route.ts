import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// 초대 코드 재생성 (리더만)
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/groups/[groupId]/invite">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId } = await ctx.params;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return Response.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });
  }
  if (group.leaderId !== session.user.id) {
    return Response.json({ error: "리더만 초대 코드를 재생성할 수 있습니다" }, { status: 403 });
  }

  const { nanoid } = await import("nanoid");
  const newCode = nanoid(10);

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { inviteCode: newCode },
  });

  return Response.json({ inviteCode: updated.inviteCode });
}
