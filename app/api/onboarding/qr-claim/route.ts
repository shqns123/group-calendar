import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractQrToken, joinWithQr, peekQr, QR_INVALID_MESSAGE } from "@/lib/qrInvite";
import { rateLimit } from "@/lib/rateLimit";

/** Active users join immediately; everyone else provides account details and scans a live QR again. */
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

  // Signup must scan a live code AFTER providing account details. Never reserve
  // an anonymous QR for hours or attach an unverified signup to the approval list.
  const qr = await peekQr(token);
  if (!qr) return Response.json({ error: QR_INVALID_MESSAGE }, { status: 410 });
  return Response.json({ loginRequired: true, groupName: qr.group.name });
}
