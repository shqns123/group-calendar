import { auth } from "@/lib/auth";
import { isObserverRole } from "@/lib/groupPermissions";
import { clearOvertimeStatus } from "@/lib/overtimeStatus";
import { prisma } from "@/lib/prisma";
import { formatSeoulDateKey, parseSeoulDateInput } from "@/lib/seoulTime";
import { NextRequest } from "next/server";

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const dateKey = searchParams.get("date");
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
      formatSeoulDateKey(parseSeoulDateInput(dateKey)) !== dateKey) {
    return Response.json({ error: "유효한 날짜가 필요합니다" }, { status: 400 });
  }

  if (groupId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
      select: { role: true, status: true },
    });
    if (member?.status !== "ACTIVE" || isObserverRole(member.role)) {
      return Response.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
    }
  }

  await clearOvertimeStatus({ userId: session.user.id, groupId, dateKey });
  return Response.json({ success: true });
}
