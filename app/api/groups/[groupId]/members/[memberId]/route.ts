import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// 멤버 닉네임 수정 (관리자, 리더, 또는 본인)
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

  const myMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } },
  });
  const isAdmin = group.leaderId === session.user.id;
  const isLeader = myMember?.role === "그룹장" || myMember?.role === "파트장";
  const isSelf = member.userId === session.user.id;

  const body = await request.json();

  // 상태 변경 (승인/거절) - 관리자 또는 리더
  if ("status" in body) {
    if (!isAdmin && !isLeader) {
      return Response.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const { status } = body;
    if (status === "REJECTED") {
      await prisma.groupMember.delete({ where: { id: memberId } });
      return Response.json({ success: true });
    }
    if (status !== "ACTIVE") {
      return Response.json({ error: "유효하지 않은 상태입니다" }, { status: 400 });
    }
    const updated = await prisma.groupMember.update({
      where: { id: memberId },
      data: { status: "ACTIVE" },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });
    return Response.json(updated);
  }

  // 역할 변경 요청 (관리자만)
  if ("role" in body) {
    if (!isAdmin) {
      return Response.json({ error: "관리자만 역할을 변경할 수 있습니다" }, { status: 403 });
    }
    const { role } = body;
    if (role !== "그룹장" && role !== "파트장" && role !== "MEMBER") {
      return Response.json({ error: "유효하지 않은 역할입니다" }, { status: 400 });
    }
    if (member.userId === group.leaderId) {
      return Response.json({ error: "관리자의 역할은 변경할 수 없습니다" }, { status: 400 });
    }
    const updated = await prisma.groupMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
    return Response.json(updated);
  }

  // 닉네임 변경
  if (!isAdmin && !isLeader && !isSelf) {
    return Response.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  if (isSelf && !isAdmin && !isLeader && myMember?.status !== "ACTIVE") {
    return Response.json({ error: "승인 대기 중에는 변경할 수 없습니다" }, { status: 403 });
  }

  const { nickname } = body;
  if (nickname && nickname.trim().length > 30) {
    return Response.json({ error: "닉네임은 30자 이하여야 합니다" }, { status: 400 });
  }

  const updated = await prisma.groupMember.update({
    where: { id: memberId },
    data: { nickname: nickname?.trim() || null },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return Response.json(updated);
}

// 멤버 추방 (관리자만, 자기 자신 불가)
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
    return Response.json({ error: "관리자만 멤버를 제거할 수 있습니다" }, { status: 403 });
  }

  const member = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!member || member.groupId !== groupId) {
    return Response.json({ error: "멤버를 찾을 수 없습니다" }, { status: 404 });
  }
  if (member.userId === session.user.id) {
    return Response.json({ error: "관리자는 스스로를 제거할 수 없습니다" }, { status: 400 });
  }

  await prisma.groupMember.delete({ where: { id: memberId } });

  return Response.json({ success: true });
}
