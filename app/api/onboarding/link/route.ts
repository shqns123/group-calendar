import { auth } from "@/lib/auth";
import { PENDING_QR_TOKEN_COOKIE_NAME } from "@/lib/inviteOnboarding";
import { consumePendingInviteForUser } from "@/lib/pendingInvite";
import { prisma } from "@/lib/prisma";
import { takeAnonymousClaim } from "@/lib/qrInvite";
import { cookies } from "next/headers";

/**
 * After logging in: a group QR scanned before login (its claim is in a cookie) now belongs to this
 * account. An approved account joins right away; a new one joins once it's approved.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const secret = cookieStore.get(PENDING_QR_TOKEN_COOKIE_NAME)?.value?.trim();
  if (!secret) {
    return Response.json({ linked: false });
  }
  cookieStore.delete(PENDING_QR_TOKEN_COOKIE_NAME);

  const claim = await takeAnonymousClaim(secret, session.user.id);
  if (!claim) {
    return Response.json({ linked: false, invalid: true });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { pendingInviteCode: claim.pendingInviteCode, pendingInviteAutoApprove: claim.autoApprove },
    select: { status: true },
  });

  if (user.status === "ACTIVE") {
    const result = await consumePendingInviteForUser(session.user.id);
    if (result.status === "created") {
      return Response.json({ linked: true, joined: true, pending: !result.autoApproved, groupName: result.groupName });
    }
    if (result.status === "exists") {
      return Response.json({ linked: true, alreadyMember: true, groupName: result.groupName });
    }
  }
  return Response.json({ linked: true, groupName: claim.groupName });
}
