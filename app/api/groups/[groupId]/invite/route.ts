import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// 초대 코드 재생성 (관리자, 그룹장, 파트장)
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/groups/[groupId]/invite">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId } = await ctx.params;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });
  if (!group) {
    return Response.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });
  }

  const isAdmin = group.leaderId === session.user.id;
  const myRole = group.members.find((m) => m.userId === session.user.id)?.role ?? "";
  const allowed = isAdmin || myRole === "그룹장" || myRole === "파트장";

  if (!allowed) {
    return Response.json({ error: "초대 코드를 재생성할 권한이 없습니다" }, { status: 403 });
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { inviteCode: generateInviteCode() },
  });

  return Response.json({ inviteCode: updated.inviteCode });
}
