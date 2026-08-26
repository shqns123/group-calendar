import { auth } from "@/lib/auth";
import { syncGroupCalendarToGitLab } from "@/lib/calendarSync";
import { isLeaderRole } from "@/lib/groupPermissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/groups/[groupId]/calendar-sync">,
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await ctx.params;
  const [group, user] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { leaderId: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } }),
  ]);
  if (!group) return Response.json({ error: "그룹을 찾을 수 없습니다." }, { status: 404 });

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } },
    select: { role: true, status: true },
  });
  const allowed = user?.isOperator || group.leaderId === session.user.id ||
    (member?.status === "ACTIVE" && isLeaderRole(member.role));
  if (!allowed) return Response.json({ error: "그룹 관리자만 업로드할 수 있습니다." }, { status: 403 });

  try {
    const result = await syncGroupCalendarToGitLab(groupId);
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("[calendar-sync] group manual GitLab upload failed", error);
    const message = error instanceof Error ? error.message : "GitLab 업로드에 실패했습니다.";
    return Response.json({ error: message }, { status: message.includes("GITLAB_") ? 503 : 502 });
  }
}
