import { auth } from "@/lib/auth";
import { PENDING_QR_TOKEN_COOKIE_NAME } from "@/lib/inviteOnboarding";
import { prisma } from "@/lib/prisma";
import { ANON_CLAIM_TTL_MS, claimQrAnonymously, extractQrToken, joinWithQr, QR_INVALID_MESSAGE, takeAnonymousClaim } from "@/lib/qrInvite";
import { rateLimit } from "@/lib/rateLimit";
import { cookies } from "next/headers";

/**
 * The web page a scanned group QR opens (`/join/qr/<token>`) calls this once. Signed in and
 * approved: join now. Otherwise the code is claimed (no one else can use it) and held in a cookie
 * until the person logs in or signs up.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = extractQrToken(body?.token);
  if (!token) {
    return Response.json({ error: QR_INVALID_MESSAGE }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!rateLimit(`qr-claim:${userId ?? req.headers.get("x-forwarded-for") ?? "anon"}`, 10, 60_000)) {
    return Response.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (user?.status === "ACTIVE") {
      const result = await joinWithQr(token, userId);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ joined: true, groupId: result.groupId, groupName: result.groupName, pending: result.pending });
    }
  }

  const claim = await claimQrAnonymously(token);
  if (!claim) {
    return Response.json({ error: QR_INVALID_MESSAGE }, { status: 410 });
  }

  // Signed in but the account isn't approved yet: the group waits on the account.
  if (userId) {
    const taken = await takeAnonymousClaim(claim.claimSecret, userId);
    if (taken) {
      await prisma.user.update({
        where: { id: userId },
        data: { pendingInviteCode: taken.pendingInviteCode, pendingInviteAutoApprove: taken.autoApprove },
      });
    }
    return Response.json({ accountPending: true, groupName: claim.groupName });
  }

  const cookieStore = await cookies();
  cookieStore.set(PENDING_QR_TOKEN_COOKIE_NAME, claim.claimSecret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ANON_CLAIM_TTL_MS / 1000),
  });
  return Response.json({ loginRequired: true, groupName: claim.groupName });
}
