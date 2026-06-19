import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// 리더 위임 (현재 리더만)
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/groups/[groupId]/leader">
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
    return Response.json({ error: "관리자만 위임할 수 있습니다" }, { status: 403 });
  }

  const body = await request.json();
  const { newLeaderUserId } = body;

  if (!newLeaderUserId) {
    return Response.json({ error: "위임할 멤버를 지정해주세요" }, { status: 400 });
  }
  if (newLeaderUserId === session.user.id) {
    return Response.json({ error: "자기 자신에게 위임할 수 없습니다" }, { status: 400 });
  }

  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: newLeaderUserId } },
  });
  if (!isMember) {
    return Response.json({ error: "해당 멤버가 그룹에 없습니다" }, { status: 404 });
  }

  await prisma.group.update({
    where: { id: groupId },
    data: { leaderId: newLeaderUserId },
  });

  return Response.json({ success: true });
}
