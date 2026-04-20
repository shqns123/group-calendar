import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webpush";

export async function POST(req: Request) {
  const { name, employeeId } = await req.json();
  if (!name?.trim() || !employeeId?.trim()) {
    return Response.json({ error: "이름과 사번을 입력해주세요." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { employeeId: employeeId.trim() } });
  if (existing) {
    return Response.json({ error: "이미 등록된 사번입니다." }, { status: 409 });
  }

  await prisma.user.create({
    data: {
      name: name.trim(),
      email: `guest_${employeeId.trim()}@local.guest`,
      employeeId: employeeId.trim(),
      status: "PENDING",
    },
  });

  // 관리자(그룹 리더)들에게 푸시 알림
  const admins = await prisma.group.findMany({
    select: { leader: { select: { pushSubscriptions: true } } },
  });
  const allSubs = admins.flatMap((g) => g.leader.pushSubscriptions);
  if (allSubs.length > 0) {
    await sendPushToUser(allSubs, {
      title: "새 가입 요청",
      body: `${name.trim()}님이 가입 승인을 요청했습니다.`,
      url: "/",
    });
  }

  return Response.json({ pending: true });
}
