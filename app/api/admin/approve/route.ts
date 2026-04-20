import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webpush";

async function isOperator(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isOperator: true } });
  return !!user?.isOperator;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isOperator(session.user.id))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { userId, action } = await req.json(); // action: "approve" | "reject"
  if (!userId || !["approve", "reject"].includes(action)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "approve") {
    await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });

    // 승인된 유저에게 푸시 알림
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length > 0) {
      await sendPushToUser(subs, {
        title: "가입 승인됨",
        body: "그룹 캘린더 가입이 승인되었습니다. 지금 로그인하세요!",
        url: "/",
      });
    }
  } else {
    await prisma.user.delete({ where: { id: userId } });
  }

  return Response.json({ ok: true });
}
