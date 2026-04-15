import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// 멤버 닉네임 수정 (리더 또는 본인)
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/groups/[groupId]/members/[memberId]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId, memberId } = await ctx.params;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return Response.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });
  }

  const member = await prisma.groupMember.findUnique({
    where: { id: memberId },
  });
  if (!member || member.groupId !== groupId) {
    return Response.json({ error: "멤버를 찾을 수 없습니다" }, { status: 404 });
  }

  const isLeader = group.leaderId === session.user.id;
  const isSelf = member.userId === session.user.id;

  if (!isLeader && !isSelf) {
    return Response.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const body = await request.json();
  const { nickname } = body;

  const updated = await prisma.groupMember.update({
    where: { id: memberId },
    data: { nickname: nickname?.trim() || null },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return Response.json(updated);
}

// 멤버 추방 (리더만, 자기 자신 불가)
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/groups/[groupId]/members/[memberId]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId, memberId } = await ctx.params;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return Response.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });
  }
  if (group.leaderId !== session.user.id) {
    return Response.json({ error: "리더만 멤버를 제거할 수 있습니다" }, { status: 403 });
  }

  const member = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!member || member.groupId !== groupId) {
    return Response.json({ error: "멤버를 찾을 수 없습니다" }, { status: 404 });
  }
  if (member.userId === session.user.id) {
    return Response.json({ error: "리더는 스스로를 제거할 수 없습니다" }, { status: 400 });
  }

  await prisma.groupMember.delete({ where: { id: memberId } });

  return Response.json({ success: true });
}
