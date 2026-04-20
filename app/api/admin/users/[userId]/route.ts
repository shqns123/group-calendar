import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (!me?.isOperator) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;

  if (userId === session.user.id) {
    return Response.json({ error: "자신의 계정은 삭제할 수 없습니다" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    return Response.json({ error: "사용자 삭제 중 오류가 발생했습니다" }, { status: 500 });
  }

  return Response.json({ success: true });
}
