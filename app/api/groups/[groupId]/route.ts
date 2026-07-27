import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function normalizeAttendanceReportTimes(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value)
        .split(/[\s,]+/)
        .filter(Boolean);

  const seen = new Set<string>();
  const times: Array<{ hour: number; minute: number; label: string }> = [];

  for (const item of rawItems) {
    const match = String(item).trim().match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) continue;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) continue;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) continue;

    const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (seen.has(label)) continue;

    seen.add(label);
    times.push({ hour, minute, label });
  }

  return times.length > 0 ? times.map((time) => time.label) : ["06:00"];
}

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
  const {
    name,
    description,
    trackerOptions,
    laptopOptions,
    targetCount,
    eventDisplayLimit,
    attendanceReportEnabled,
    attendanceReportTo,
    attendanceReportHour,
    attendanceReportMinute,
    attendanceReportTimes,
  } = body;
  const normalizedTargetCount =
    targetCount === undefined ? undefined : Math.max(0, Math.min(100, Number(targetCount) || 0));
  const normalizedEventDisplayLimit =
    eventDisplayLimit === undefined
      ? undefined
      : Math.max(1, Math.min(10, Number(eventDisplayLimit) || 3));
  const normalizedAttendanceReportHour =
    attendanceReportHour === undefined
      ? undefined
      : Math.max(0, Math.min(23, Number(attendanceReportHour) || 0));
  const normalizedAttendanceReportMinute =
    attendanceReportMinute === undefined
      ? undefined
      : Math.max(0, Math.min(59, Number(attendanceReportMinute) || 0));
  const normalizedAttendanceReportTimes =
    attendanceReportTimes === undefined
      ? undefined
      : normalizeAttendanceReportTimes(attendanceReportTimes);
  const firstAttendanceReportTime = normalizedAttendanceReportTimes?.[0]
    ?.split(":")
    .map(Number);

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() }),
      ...(trackerOptions !== undefined && { trackerOptions: String(trackerOptions).trim() || null }),
      ...(laptopOptions !== undefined && { laptopOptions: String(laptopOptions).trim() || null }),
      ...(normalizedTargetCount !== undefined && { targetCount: normalizedTargetCount }),
      ...(normalizedEventDisplayLimit !== undefined && { eventDisplayLimit: normalizedEventDisplayLimit }),
      ...(attendanceReportEnabled !== undefined && { attendanceReportEnabled: !!attendanceReportEnabled }),
      ...(attendanceReportTo !== undefined && { attendanceReportTo: String(attendanceReportTo).trim() || null }),
      ...(normalizedAttendanceReportTimes !== undefined && {
        attendanceReportTimes: JSON.stringify(normalizedAttendanceReportTimes),
      }),
      ...(firstAttendanceReportTime && {
        attendanceReportHour: firstAttendanceReportTime[0],
        attendanceReportMinute: firstAttendanceReportTime[1],
      }),
      ...(normalizedAttendanceReportTimes === undefined &&
        normalizedAttendanceReportHour !== undefined && { attendanceReportHour: normalizedAttendanceReportHour }),
      ...(normalizedAttendanceReportTimes === undefined &&
        normalizedAttendanceReportMinute !== undefined && { attendanceReportMinute: normalizedAttendanceReportMinute }),
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
