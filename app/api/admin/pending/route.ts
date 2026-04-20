import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 관리자 여부 확인 (그룹 리더)
async function isAdmin(userId: string) {
  const group = await prisma.group.findFirst({ where: { leaderId: userId } });
  return !!group;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.user.id))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const pending = await prisma.user.findMany({
    where: { status: "PENDING" },
    select: { id: true, name: true, email: true, employeeId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(pending);
}
