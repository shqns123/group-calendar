import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function isOperator(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isOperator: true } });
  return !!user?.isOperator;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isOperator(session.user.id))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const pending = await prisma.user.findMany({
    where: { status: "PENDING" },
    select: { id: true, name: true, email: true, employeeId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(pending);
}
