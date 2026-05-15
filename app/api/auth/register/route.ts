import {
  PENDING_INVITE_COOKIE_NAME,
  PENDING_QR_TOKEN_COOKIE_NAME,
} from "@/lib/inviteOnboarding";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webpush";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { name, employeeId } = await req.json();
  if (!name?.trim() || !employeeId?.trim()) {
    return Response.json({ error: "이름과 사번을 입력해 주세요." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { employeeId: employeeId.trim() },
  });
  if (existing) {
    return Response.json({ error: "이미 등록된 사번입니다." }, { status: 409 });
  }

  const token = req.cookies.get(PENDING_QR_TOKEN_COOKIE_NAME)?.value?.trim();
  const inviteCodeCookie = req.cookies.get(PENDING_INVITE_COOKIE_NAME)?.value?.trim();
  let pendingInviteCode: string | null = null;
  let pendingInviteAutoApprove = false;

  if (token) {
    const qrToken = await prisma.qrInviteToken.findUnique({
      where: { token },
      select: {
        expiresAt: true,
        group: { select: { inviteCode: true } },
      },
    });
    if (qrToken && qrToken.expiresAt >= new Date()) {
      pendingInviteCode = qrToken.group.inviteCode;
      pendingInviteAutoApprove = true;
    }
  } else if (inviteCodeCookie) {
    const group = await prisma.group.findUnique({
      where: { inviteCode: inviteCodeCookie },
      select: { inviteCode: true },
    });
    if (group) {
      pendingInviteCode = group.inviteCode;
      pendingInviteAutoApprove = true;
    }
  }

  await prisma.user.create({
    data: {
      name: name.trim(),
      email: `guest_${employeeId.trim()}@local.guest`,
      employeeId: employeeId.trim(),
      status: "PENDING",
      pendingInviteCode,
      pendingInviteAutoApprove,
    },
  });

  const admins = await prisma.group.findMany({
    select: { leader: { select: { pushSubscriptions: true } } },
  });
  const allSubs = admins.flatMap((group) => group.leader.pushSubscriptions);
  if (allSubs.length > 0) {
    await sendPushToUser(allSubs, {
      title: "회원가입 요청",
      body: `${name.trim()}님이 가입 승인을 요청했습니다.`,
      url: "/",
    });
  }

  const response = NextResponse.json({ pending: true });
  if (token) {
    response.cookies.delete(PENDING_QR_TOKEN_COOKIE_NAME);
  }
  if (inviteCodeCookie) {
    response.cookies.delete(PENDING_INVITE_COOKIE_NAME);
  }
  return response;
}
