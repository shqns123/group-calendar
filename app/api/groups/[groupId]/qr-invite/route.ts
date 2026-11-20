import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueQrToken, qrIssuePolicy } from "@/lib/qrInvite";
import { rateLimit } from "@/lib/rateLimit";
import { QR_LEASE_MS } from "@/lib/signupPolicy";

async function revokeToken(groupId: string, userId: string, token: unknown) {
  if (typeof token !== "string" || !token) return Response.json({ error: "token required" }, { status: 400 });
  await prisma.qrInviteToken.updateMany({ where: { token, groupId, createdById: userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return Response.json({ ok: true });
}

/**
 * A new single-use QR code for the group (the inviter's screen asks for one every minute, and right
 * after its code was scanned). Any active member may invite; codes from an operator, the group
 * admin, 그룹장 or 파트장 join without approval.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/groups/[groupId]/qr-invite">) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId } = await ctx.params;
  // sendBeacon uses POST when the browser hides or closes the issuing window.
  const body = await req.json().catch(() => null);
  if (body?.action === "revoke") return revokeToken(groupId, session.user.id, body.token);

  if (!rateLimit(`qr-invite:${session.user.id}`, 20, 60_000)) {
    return Response.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const policy = await qrIssuePolicy(session.user.id, groupId);
  if (!policy.found) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }
  if (!policy.canIssue) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const issued = await issueQrToken(groupId, session.user.id, policy.autoApprove);
  return Response.json({ ...issued, expiresAt: issued.expiresAt.toISOString() });
}

/** Whether the inviter's current code has been scanned (`?token=`), so their screen can replace it. */
export async function GET(req: Request, ctx: RouteContext<"/api/groups/[groupId]/qr-invite">) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return Response.json({ error: "token required" }, { status: 400 });
  }

  const row = await prisma.qrInviteToken.findFirst({
    where: { token, groupId, createdById: session.user.id },
    select: { usedAt: true, expiresAt: true, revokedAt: true, leaseUntil: true },
  });
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ scanned: row.usedAt !== null, expired: !!row.revokedAt || row.expiresAt <= new Date() || !row.leaseUntil || row.leaseUntil <= new Date() });
}

/** A heartbeat may extend the short window lease, never the QR's 60-second expiry. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/groups/[groupId]/qr-invite">) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { groupId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (typeof body?.token !== "string") return Response.json({ error: "token required" }, { status: 400 });
  const now = new Date();
  const renewed = await prisma.qrInviteToken.updateMany({ where: {
    token: body.token, groupId, createdById: session.user.id, usedAt: null, revokedAt: null,
    expiresAt: { gt: now }, leaseUntil: { gt: now }, createdBy: { status: "ACTIVE" },
  }, data: { leaseUntil: new Date(now.getTime() + QR_LEASE_MS) } });
  const row = await prisma.qrInviteToken.findFirst({ where: { token: body.token, groupId, createdById: session.user.id }, select: { usedAt: true } });
  return Response.json({ live: renewed.count === 1, scanned: !!row?.usedAt });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/groups/[groupId]/qr-invite">) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { groupId } = await ctx.params;
  const body = await req.json().catch(() => null);
  return revokeToken(groupId, session.user.id, body?.token);
}
