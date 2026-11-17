import { PENDING_QR_TOKEN_COOKIE_NAME } from "@/lib/inviteOnboarding";
import { sendMobilePushToTokens } from "@/lib/mobilepush";
import { prisma } from "@/lib/prisma";
import { takeAnonymousClaim } from "@/lib/qrInvite";
import { sendPushToUser } from "@/lib/webpush";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { name, employeeId, pushToken } = await req.json();
  if (!name?.trim() || !employeeId?.trim()) {
    return Response.json({ error: "이름과 사번을 입력해 주세요." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { employeeId: employeeId.trim() },
  });
  if (existing) {
    return Response.json({ error: "이미 등록된 사번입니다." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: `guest_${employeeId.trim()}@local.guest`,
      employeeId: employeeId.trim(),
      status: "PENDING",
    },
  });

  // Scanned a group QR before signing up: the group is joined once the account is approved.
  const claim = await takeAnonymousClaim(req.cookies.get(PENDING_QR_TOKEN_COOKIE_NAME)?.value?.trim(), user.id);
  if (claim) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingInviteCode: claim.pendingInviteCode, pendingInviteAutoApprove: claim.autoApprove },
    });
  }

  // The app signs up without a session, so it sends its phone's push token here; the
  // "가입 승인" push then reaches that phone once an operator approves the account.
  const devicePushToken = typeof pushToken === "string" ? pushToken.trim() : "";
  if (devicePushToken) {
    await prisma.mobileDeviceToken.upsert({
      where: { token: devicePushToken },
      update: { userId: user.id, platform: "ANDROID" },
      create: { userId: user.id, token: devicePushToken, platform: "ANDROID" },
    });
  }

  const admins = await prisma.group.findMany({
    select: { leader: { select: { pushSubscriptions: true, mobileDeviceTokens: true } } },
  });
  const allSubs = admins.flatMap((group) => group.leader.pushSubscriptions);
  const allMobileTokens = admins.flatMap((group) =>
    group.leader.mobileDeviceTokens.map((device) => device.token),
  );

  if (allSubs.length > 0) {
    await sendPushToUser(allSubs, {
      title: "회원가입 요청",
      body: `${name.trim()} 님이 가입 승인을 요청했습니다.`,
      url: "/",
    });
  }
  if (allMobileTokens.length > 0) {
    await sendMobilePushToTokens(allMobileTokens, {
      title: "회원가입 요청",
      body: `${name.trim()} 님이 가입 승인을 요청했습니다.`,
      url: "/",
    });
  }

  const response = NextResponse.json({ pending: true });
  response.cookies.delete(PENDING_QR_TOKEN_COOKIE_NAME);
  return response;
}
