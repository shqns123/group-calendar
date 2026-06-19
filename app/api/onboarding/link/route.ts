import { auth } from "@/lib/auth";
import {
  PENDING_INVITE_COOKIE_NAME,
  PENDING_QR_TOKEN_COOKIE_NAME,
} from "@/lib/inviteOnboarding";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_QR_TOKEN_COOKIE_NAME)?.value?.trim();
  const inviteCode = cookieStore.get(PENDING_INVITE_COOKIE_NAME)?.value?.trim();
  if (!token && !inviteCode) {
    return Response.json({ linked: false });
  }

  if (token) {
    const qrToken = await prisma.qrInviteToken.findUnique({
      where: { token },
      select: {
        expiresAt: true,
        group: { select: { name: true, inviteCode: true } },
      },
    });

    cookieStore.delete(PENDING_QR_TOKEN_COOKIE_NAME);

    if (!qrToken || qrToken.expiresAt < new Date()) {
      return Response.json({ linked: false, invalid: true });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        pendingInviteCode: qrToken.group.inviteCode,
        pendingInviteAutoApprove: true,
      },
    });

    return Response.json({ linked: true, groupName: qrToken.group.name });
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode: inviteCode! },
    select: { name: true, inviteCode: true },
  });
  cookieStore.delete(PENDING_INVITE_COOKIE_NAME);
  if (!group) {
    return Response.json({ linked: false, invalid: true });
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      pendingInviteCode: group.inviteCode,
      pendingInviteAutoApprove: true,
    },
  });
  return Response.json({ linked: true, groupName: group.name });
}
