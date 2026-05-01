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

  const myMember = group.members.find((m) => m.userId === session.user.id);
  const meGet = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  const isActiveMember = myMember?.status === "ACTIVE" || group.leaderId === session.user.id || meGet?.isOperator;
  if (!isActiveMember) {
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
  const mePatch = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (group.leaderId !== session.user.id && !mePatch?.isOperator) {
    return Response.json({ error: "관리자만 수정할 수 있습니다" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, trackerOptions, laptopOptions, targetCount } = body;
  const normalizedTargetCount =
    targetCount === undefined ? undefined : Math.max(0, Math.min(100, Number(targetCount) || 0));

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() }),
      ...(trackerOptions !== undefined && { trackerOptions: String(trackerOptions).trim() || null }),
      ...(laptopOptions !== undefined && { laptopOptions: String(laptopOptions).trim() || null }),
      ...(normalizedTargetCount !== undefined && { targetCount: normalizedTargetCount }),
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
  const meDel = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (group.leaderId !== session.user.id && !meDel?.isOperator) {
    return Response.json({ error: "관리자만 삭제할 수 있습니다" }, { status: 403 });
  }

  await prisma.group.delete({ where: { id: groupId } });

  return Response.json({ success: true });
}
