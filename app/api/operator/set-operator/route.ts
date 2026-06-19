import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (!me?.isOperator) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { userId, isOperator } = await req.json();
  if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
  if (userId === session.user.id) return Response.json({ error: "자신의 운영자 권한은 변경할 수 없습니다" }, { status: 400 });

  await prisma.user.update({ where: { id: userId }, data: { isOperator } });
  return Response.json({ ok: true });
}
