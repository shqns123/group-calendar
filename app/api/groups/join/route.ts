import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 사용자당 1분에 10회 제한
  if (!rateLimit(`join:${session.user.id}`, 10, 60_000)) {
    return Response.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const body = await request.json();
  const { inviteCode, nickname, checkOnly } = body;

  if (!inviteCode?.trim()) {
    return Response.json({ error: "초대 코드를 입력해주세요" }, { status: 400 });
  }

  const group = await prisma.group.findFirst({
    where: { inviteCode: inviteCode.trim() },
  });

  if (!group) {
    return Response.json({ error: "유효하지 않은 초대 코드입니다" }, { status: 404 });
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: session.user.id } },
  });

  if (existing) {
    return Response.json({ error: "이미 참가한 그룹입니다" }, { status: 409 });
  }

  if (checkOnly) {
    return Response.json({ groupId: group.id, groupName: group.name });
  }

  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: session.user.id,
      nickname: nickname?.trim() || null,
      role: "MEMBER",
      status: "PENDING",
    },
  });

  return Response.json({ success: true, groupId: group.id, groupName: group.name, pending: true });
}
