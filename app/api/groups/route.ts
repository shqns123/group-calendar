import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// 내 그룹 목록 조회
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    where: {
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
