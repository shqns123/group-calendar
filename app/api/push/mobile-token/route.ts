import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ registered: false });

  const count = await prisma.mobileDeviceToken.count({
    where: { userId: session.user.id, platform: "ANDROID" },
  });
  return Response.json({ registered: count > 0 });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return Response.json({ error: "token required" }, { status: 400 });
  }

  await prisma.mobileDeviceToken.upsert({
    where: { token: normalizedToken },
    update: {
      userId: session.user.id,
      platform: "ANDROID",
    },
    create: {
      userId: session.user.id,
      token: normalizedToken,
      platform: "ANDROID",
    },
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return Response.json({ error: "token required" }, { status: 400 });
  }

  await prisma.mobileDeviceToken.deleteMany({
    where: { token: normalizedToken, userId: session.user.id },
  });

  return Response.json({ ok: true });
}
