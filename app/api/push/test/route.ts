import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import webpush from "web-push";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.pushSubscription.deleteMany({ where: { userId: session.user.id } });
  return Response.json({ ok: true, message: "구독 삭제 완료. 앱 새로고침 후 다시 허용해줘." });
}

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
    return Response.json({ error: "구독 없음" });
  }

  const vapidEmail = process.env.VAPID_EMAIL;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!vapidEmail || !vapidPublic || !vapidPrivate) {
    return Response.json({ error: "VAPID 키 미설정", vapidEmail: !!vapidEmail, vapidPublic: !!vapidPublic, vapidPrivate: !!vapidPrivate });
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: "테스트 알림", body: "푸시 알림 테스트입니다!", url: "/" })
      )
    )
  );

  return Response.json({
    results: results.map((r, i) => ({
      sub: subs[i].endpoint.slice(0, 50) + "...",
      status: r.status,
      ...(r.status === "rejected" ? { error: String(r.reason) } : { statusCode: (r.value as { statusCode: number }).statusCode }),
    })),
  });
}
