import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();
  if (!token) {
    return Response.json({ error: "token required" }, { status: 400 });
  }

  const qrToken = await prisma.qrInviteToken.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      group: { select: { inviteCode: true, name: true } },
    },
  });

  if (!qrToken || qrToken.expiresAt < new Date()) {
    return Response.json({ error: "Invite token is invalid or expired." }, { status: 404 });
  }

  return Response.json({
    inviteCode: qrToken.group.inviteCode,
    groupName: qrToken.group.name,
    autoApprove: true,
  });
}
