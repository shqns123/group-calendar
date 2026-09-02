import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// 내 그룹 목록 조회
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });

  const groups = await prisma.group.findMany({
    where: me?.isOperator ? undefined : {
      OR: [
        { leaderId: session.user.id },
        { members: { some: { userId: session.user.id, status: "ACTIVE" } } },
      ],
    },
    include: {
      leader: { select: { id: true, name: true, email: true, image: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      _count: { select: { events: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(groups);
}

// 그룹 생성
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me2 = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (!me2?.isOperator) {
    return Response.json({ error: "그룹 생성은 운영자만 가능합니다" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description } = body;

  if (!name?.trim()) {
    return Response.json({ error: "그룹 이름은 필수입니다" }, { status: 400 });
  }
  if (name.trim().length > 50) {
    return Response.json({ error: "그룹 이름은 50자 이하여야 합니다" }, { status: 400 });
  }
  if (description && description.trim().length > 200) {
    return Response.json({ error: "설명은 200자 이하여야 합니다" }, { status: 400 });
  }

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      description: description?.trim(),
      inviteCode: generateInviteCode(),
      leaderId: session.user.id,
      members: {
        create: {
          userId: session.user.id,
          nickname: session.user.name || undefined,
          role: "ADMIN",
        },
      },
    },
    include: {
      leader: { select: { id: true, name: true, email: true, image: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  return Response.json(group, { status: 201 });
}
