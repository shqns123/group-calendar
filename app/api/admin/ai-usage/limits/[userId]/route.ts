import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultMonthlyLimit } from "@/lib/aiUsage";

// PUT /api/admin/ai-usage/limits/:userId { monthlyLimit: number | null } — operator only.
// A number (0–100000) sets the user's monthly AI call cap; null goes back to the default cap.

const MAX_LIMIT = 100_000;

export async function PUT(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (!me?.isOperator) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const body = await req.json().catch(() => null);
  const value = body?.monthlyLimit;

  if (value === null) {
    await prisma.aiUsageLimit.deleteMany({ where: { userId } });
    return Response.json({ userId, customLimit: null, limit: defaultMonthlyLimit() });
  }
  if (!Number.isInteger(value) || value < 0 || value > MAX_LIMIT) {
    return Response.json({ error: `0부터 ${MAX_LIMIT.toLocaleString()} 사이의 정수로 적어 주세요` }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return Response.json({ error: "사용자를 찾을 수 없어요" }, { status: 404 });

  await prisma.aiUsageLimit.upsert({
    where: { userId },
    create: { userId, monthlyLimit: value, updatedById: session.user.id },
    update: { monthlyLimit: value, updatedById: session.user.id },
  });
  return Response.json({ userId, customLimit: value, limit: value });
}
