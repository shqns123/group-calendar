import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (!me?.isOperator) return Response.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      employeeId: true,
      isOperator: true,
      createdAt: true,
      groupMembers: {
        select: {
          id: true,
          role: true,
          group: { select: { id: true, name: true, leaderId: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(users);
}
