import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const adminGroup = await prisma.group.findFirst({ where: { leaderId: session.user.id } });
  if (!adminGroup) return Response.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      employeeId: true,
      createdAt: true,
      groupMembers: {
        select: {
          role: true,
          group: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(users);
}
