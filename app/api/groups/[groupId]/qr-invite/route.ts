import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueQrToken, qrIssuePolicy } from "@/lib/qrInvite";
import { rateLimit } from "@/lib/rateLimit";

/**
 * A new single-use QR code for the group (the inviter's screen asks for one every minute, and right
 * after its code was scanned). Any active member may invite; codes from an operator, the group
 * admin, 그룹장 or 파트장 join without approval.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/groups/[groupId]/qr-invite">) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId } = await ctx.params;

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
    select: { claimedAt: true, expiresAt: true },
  });
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ scanned: row.claimedAt !== null, expired: row.expiresAt < new Date() });
}
