import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { claimQrForUser, extractQrToken, INVITE_CODE_GONE_MESSAGE, joinWithQr, QR_INVALID_MESSAGE } from "@/lib/qrInvite";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest } from "next/server";

/**
 * Join a group with a scanned QR code: `{ token }` (the QR's URL or its token), `nickname`, and
 * `checkOnly` to claim the code and see the group first (the code is then held for this user while
 * they enter a nickname). Invite codes no longer work.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // 사용자당 1분에 10회로 제한
  if (!rateLimit(`join:${userId}`, 10, 60_000)) {
    return Response.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const { nickname, checkOnly } = body ?? {};
  const token = extractQrToken(body?.token ?? body?.qr);

  if (!token) {
    const error = body?.inviteCode ? INVITE_CODE_GONE_MESSAGE : "QR 코드를 스캔해 주세요.";
    return Response.json({ error }, { status: body?.inviteCode ? 410 : 400 });
  }

  if (checkOnly) {
    // Look before claiming, so a member scanning their own group's code doesn't use it up.
    const target = await prisma.qrInviteToken.findUnique({ where: { token }, select: { groupId: true } });
    if (target) {
      const existing = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: target.groupId, userId } },
        select: { id: true },
      });
      if (existing) return Response.json({ error: "이미 참가 중인 그룹입니다." }, { status: 409 });
    }
    const row = await claimQrForUser(token, userId);
    if (!row) return Response.json({ error: QR_INVALID_MESSAGE }, { status: 410 });
    return Response.json({ groupId: row.groupId, groupName: row.group.name, autoApprove: row.autoApprove });
  }

  const result = await joinWithQr(token, userId, typeof nickname === "string" ? nickname : null);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ success: true, groupId: result.groupId, groupName: result.groupName, pending: result.pending });
}
