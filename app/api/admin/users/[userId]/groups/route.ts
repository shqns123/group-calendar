import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/users/[userId]/groups">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isOperator: true },
  });
  if (!me?.isOperator) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const groupId = typeof body?.groupId === "string" ? body.groupId.trim() : "";

  if (!groupId) {
    return Response.json({ error: "groupId is required" }, { status: 400 });
  }

  const [targetUser, group, existingMembership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    }),
    prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    }),
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    }),
  ]);

  if (!targetUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  if (existingMembership?.status === "ACTIVE") {
    return Response.json({ error: "User is already in this group" }, { status: 409 });
  }

  const membership = existingMembership
    ? await prisma.groupMember.update({
        where: { id: existingMembership.id },
        data: {
          status: "ACTIVE",
          role: existingMembership.role || "MEMBER",
          nickname: existingMembership.nickname ?? targetUser.name ?? null,
        },
        include: {
          group: { select: { id: true, name: true, leaderId: true } },
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      })
    : await prisma.groupMember.create({
        data: {
          groupId,
          userId,
          nickname: targetUser.name ?? null,
          role: "MEMBER",
          status: "ACTIVE",
        },
        include: {
          group: { select: { id: true, name: true, leaderId: true } },
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });

  return Response.json(membership, { status: existingMembership ? 200 : 201 });
}
