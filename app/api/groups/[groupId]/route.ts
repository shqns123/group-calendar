import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// 그룹 상세 조회
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/groups/[groupId]">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId } = await ctx.params;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      leader: { select: { id: true, name: true, email: true, image: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!group) {
    return Response.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });
  }

  const isMember = group.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });
  }

  return Response.json(group);
}

// 그룹 수정 (리더만)
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/groups/[groupId]">
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
    return Response.json({ error: "관리자만 수정할 수 있습니다" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description } = body;

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() }),
    },
  });

  return Response.json(updated);
}

// 그룹 삭제 (리더만)
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/groups/[groupId]">
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
    return Response.json({ error: "관리자만 삭제할 수 있습니다" }, { status: 403 });
  }

  await prisma.group.delete({ where: { id: groupId } });

  return Response.json({ success: true });
}
