import type { Prisma, PrismaClient } from "@prisma/client";
import { newGuestEmail } from "./guestEmail.ts";
import { quotaRules, SignupError, type SignupIdentity } from "./signupPolicy.ts";

type GoogleProfile = { sub: string; email: string; name?: string; picture?: string };

async function enforceQuotas(tx: Prisma.TransactionClient, identity: SignupIdentity, phase: "attempt" | "signup", now: Date) {
  for (const rule of quotaRules(identity, phase, now)) {
    await tx.signupQuota.upsert({ where: { key: rule.key },
      create: { key: rule.key, count: 0, expiresAt: new Date(now.getTime() + rule.duration) }, update: {} });
    await tx.signupQuota.updateMany({ where: { key: rule.key, expiresAt: { lte: now } },
      data: { count: 0, expiresAt: new Date(now.getTime() + rule.duration) } });
    const claimed = await tx.signupQuota.updateMany({ where: { key: rule.key, count: { lt: rule.max } }, data: { count: { increment: 1 } } });
    if (!claimed.count) {
      const row = await tx.signupQuota.findUniqueOrThrow({ where: { key: rule.key } });
      throw new SignupError(phase === "attempt" ? "요청이 너무 많아요. 잠시 후 다시 시도해 주세요."
        : rule.kind === "device" ? "이 기기에서는 24시간에 한 번만 가입을 요청할 수 있어요."
        : "같은 네트워크에서 가입 요청이 많아요. 1시간 후 다시 시도해 주세요.", 429, Math.max(1, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000)));
    }
  }
}

export async function recordSignupAttempt(db: PrismaClient, identity: SignupIdentity, now = new Date()) {
  await db.signupQuota.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } } });
  await db.$transaction((tx) => enforceQuotas(tx, identity, "attempt", now));
}

export async function registerInvitedUser(db: PrismaClient, input: {
  identity: SignupIdentity; token: string; name?: string; employeeId?: string;
  google?: GoogleProfile | null; pushToken?: string;
}, now = new Date()) {
  return db.$transaction(async (tx) => {
    const qr = await tx.qrInviteToken.findFirst({ where: { token: input.token, usedAt: null, claimedAt: null,
      revokedAt: null, expiresAt: { gt: now }, leaseUntil: { gt: now },
      createdBy: { status: "ACTIVE" } }, include: { group: { select: { inviteCode: true, name: true } } } });
    if (!qr) throw new SignupError("이미 사용됐거나 만료된 QR 코드예요. 초대 창을 열어 새 QR 코드를 받아 주세요.", 410);
    const existing = input.google
      ? await tx.user.findUnique({ where: { email: input.google.email } })
      : await tx.user.findUnique({ where: { employeeId: input.employeeId! } });
    if (existing && (existing.status !== "PENDING" || existing.signupVerifiedAt || (!input.google && existing.name !== input.name))) {
      throw new SignupError("이미 등록된 계정입니다. 로그인하거나 운영자에게 문의해 주세요.", 409);
    }
    await enforceQuotas(tx, input.identity, "signup", now);
    const spent = await tx.qrInviteToken.updateMany({ where: { id: qr.id, claimedAt: null, usedAt: null,
      revokedAt: null, expiresAt: { gt: now }, leaseUntil: { gt: now } }, data: { claimedAt: now, usedAt: now } });
    if (spent.count !== 1) throw new SignupError("이미 사용된 QR 코드예요. 새 QR 코드를 받아 주세요.", 410);
    const data = { status: "PENDING", signupVerifiedAt: now, pendingInviteCode: qr.group.inviteCode,
      pendingInviteAutoApprove: qr.autoApprove };
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data })
      : await tx.user.create({ data: { ...data,
          name: input.google?.name ?? input.name, image: input.google?.picture,
          email: input.google?.email ?? newGuestEmail(),
          employeeId: input.google ? undefined : input.employeeId } });
    await tx.qrInviteToken.update({ where: { id: qr.id }, data: { claimedById: user.id } });
    if (input.google) {
      const account = await tx.account.findUnique({ where: { provider_providerAccountId: { provider: "google", providerAccountId: input.google.sub } } });
      if (account && account.userId !== user.id) throw new SignupError("이미 연결된 Google 계정입니다.", 409);
      await tx.account.upsert({ where: { provider_providerAccountId: { provider: "google", providerAccountId: input.google.sub } },
        update: {}, create: { userId: user.id, type: "oauth", provider: "google", providerAccountId: input.google.sub } });
    }
    if (input.pushToken) {
      await tx.mobileDeviceToken.upsert({ where: { token: input.pushToken }, update: { userId: user.id, platform: "ANDROID" },
        create: { userId: user.id, token: input.pushToken, platform: "ANDROID" } });
    }
    return { user, groupName: qr.group.name };
  });
}
