import { auth } from "@/lib/auth";
import { isLeaderRole } from "@/lib/groupPermissions";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/groups/[groupId]/qr-invite">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await ctx.params;
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isOperator: true },
  });
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } },
    select: { role: true, status: true },
  });

  const canIssue =
    group.leaderId === session.user.id ||
    !!me?.isOperator ||
    (member?.status === "ACTIVE" && isLeaderRole(member.role));

  if (!canIssue) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const token = crypto.randomBytes(24).toString("base64url");

  await prisma.qrInviteToken.create({
    data: {
      token,
      groupId,
      createdById: session.user.id,
      expiresAt,
    },
  });

  return Response.json({ token, expiresAt: expiresAt.toISOString() });
}
