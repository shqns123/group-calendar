import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webpush";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  return Response.json({
    subscriptionCount: subs.length,
    endpoints: subs.map((s) => s.endpoint.slice(0, 60) + "..."),
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  if (subs.length === 0) {
    return Response.json({ error: "구독 없음 — 앱에서 알림 허용 먼저 필요" });
  }

  await sendPushToUser(subs, {
    title: "테스트 알림",
    body: "푸시 알림이 정상 작동합니다!",
    url: "/",
  });

  return Response.json({ ok: true, sentTo: subs.length });
}
