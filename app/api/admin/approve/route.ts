import { auth } from "@/lib/auth";
import { sendMobilePushToTokens } from "@/lib/mobilepush";
import { consumePendingInviteForUser } from "@/lib/pendingInvite";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webpush";

async function isOperator(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isOperator: true },
  });
  return !!user?.isOperator;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isOperator(session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, action } = await req.json();
  if (!userId || !["approve", "reject"].includes(action)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "approve") {
    await prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" },
    });
    await consumePendingInviteForUser(userId);

    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    const mobileTokens = await prisma.mobileDeviceToken.findMany({
      where: { userId, platform: "ANDROID" },
    });

    if (subs.length > 0) {
      await sendPushToUser(subs, {
        title: "가입 승인",
        body: "계정 승인이 완료되었습니다. 로그인 후 이용해 주세요.",
        url: "/",
      });
    }
    if (mobileTokens.length > 0) {
      await sendMobilePushToTokens(mobileTokens.map((item) => item.token), {
        title: "가입 승인",
        body: "계정 승인이 완료되었습니다. 로그인 후 이용해 주세요.",
        url: "/",
      });
    }
  } else {
    await prisma.user.delete({ where: { id: userId } });
  }

  return Response.json({ ok: true });
}
