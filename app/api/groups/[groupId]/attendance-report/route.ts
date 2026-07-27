import { auth } from "@/lib/auth";
import { sendDailyAttendanceReport } from "@/lib/attendanceReport";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/groups/[groupId]/attendance-report">,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await ctx.params;
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      leaderId: true,
      attendanceReportTo: true,
    },
  });

  if (!group) {
    return Response.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isOperator: true },
  });

  if (group.leaderId !== session.user.id && !me?.isOperator) {
    return Response.json({ error: "관리자만 발송할 수 있습니다" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const recipient =
    typeof body.attendanceReportTo === "string" && body.attendanceReportTo.trim()
      ? body.attendanceReportTo.trim()
      : group.attendanceReportTo;

  const result = await sendDailyAttendanceReport(new Date(), {
    groupId: group.id,
    to: recipient,
  });

  if (!result.sent) {
    return Response.json(
      {
        error: "메일 설정 또는 수신자가 없어 발송하지 못했습니다",
        count: result.count,
        fileName: result.fileName,
      },
      { status: 400 },
    );
  }

  return Response.json({
    success: true,
    count: result.count,
    fileName: result.fileName,
  });
}
