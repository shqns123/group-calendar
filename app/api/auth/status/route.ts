import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ status: null }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });

  return Response.json({ status: user?.status ?? null });
}
