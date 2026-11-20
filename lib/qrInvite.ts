import "server-only";

import crypto from "node:crypto";
import { isLeaderRole } from "@/lib/groupPermissions";
import { createJoinRequestNotification } from "@/lib/notificationStore";
import { eventBus } from "@/lib/eventBus";
import { prisma } from "@/lib/prisma";
import { QR_LEASE_MS, QR_LIFETIME_MS } from "./signupPolicy";

/** A QR is single-use, valid for exactly 60 seconds, and only live while its issuer's window is open. */
export const QR_REFRESH_SECONDS = 60;
const QR_TTL_MS = QR_LIFETIME_MS;

export const QR_INVALID_MESSAGE = "이미 사용됐거나 만료된 QR 코드예요. 새 QR 코드를 받아 주세요.";
export const INVITE_CODE_GONE_MESSAGE = "초대 코드 가입은 종료됐어요. 그룹 멤버에게 QR 코드를 받아 스캔해 주세요.";

/** Pull the token out of a scanned QR (`…/join/qr/<token>`) or a bare token. */
export function extractQrToken(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  const fromUrl = value.match(/\/join\/qr\/([A-Za-z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9_-]{16,}$/.test(value) ? value : null;
}

/**
 * Who may make a QR code for the group, and whether it skips approval: any active member may
 * invite; codes from an operator, the group admin, 그룹장 or 파트장 join without approval.
 */
export async function qrIssuePolicy(userId: string, groupId: string) {
  const [group, me, member] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { id: true, leaderId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isOperator: true, status: true } }),
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true, status: true },
    }),
  ]);
  if (!group) return { found: false as const };
  const active = member?.status === "ACTIVE";
  const isAdmin = group.leaderId === userId;
  const isOperator = !!me?.isOperator;
  return {
    found: true as const,
    canIssue: me?.status === "ACTIVE" && (isOperator || isAdmin || active),
    autoApprove: isOperator || isAdmin || (active && isLeaderRole(member?.role)),
  };
}

export async function issueQrToken(groupId: string, createdById: string, autoApprove: boolean) {
  const now = Date.now();
  // Remove expired, unclaimed codes left by closed windows.
  await prisma.qrInviteToken.deleteMany({
    where: { claimedAt: null, expiresAt: { lt: new Date(now - 60 * 60_000) } },
  });
  // Replacing a code revokes all previous unused codes from this issuer for the group.
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(now + QR_TTL_MS);
  await prisma.$transaction(async (tx) => {
    await tx.qrInviteToken.updateMany({ where: { groupId, createdById, usedAt: null, revokedAt: null }, data: { revokedAt: new Date(now) } });
    await tx.qrInviteToken.create({ data: { token, groupId, createdById, expiresAt, autoApprove, leaseUntil: new Date(now + QR_LEASE_MS) } });
  });
  return { token, expiresAt, autoApprove, refreshSeconds: QR_REFRESH_SECONDS };
}

type QrRow = { id: string; groupId: string; autoApprove: boolean; group: { id: string; name: string; inviteCode: string } };

const QR_SELECT = {
  id: true,
  groupId: true,
  autoApprove: true,
  group: { select: { id: true, name: true, inviteCode: true } },
} as const;

/**
 * Claim a code for a signed-in user (the first scan wins). Claiming it again by the same user is
 * allowed only while the original QR expiry and issuing-window lease remain valid.
 */
export async function claimQrForUser(token: string, userId: string): Promise<QrRow | null> {
  const now = new Date();
  const claimed = await prisma.qrInviteToken.updateMany({
    where: { token, claimedAt: null, usedAt: null, revokedAt: null, expiresAt: { gt: now }, leaseUntil: { gt: now } },
    data: { claimedById: userId, claimedAt: now },
  });
  return prisma.qrInviteToken.findFirst({
    where: claimed.count === 1
      ? { token, revokedAt: null, expiresAt: { gt: now }, leaseUntil: { gt: now } }
      : { token, claimedById: userId, usedAt: null, revokedAt: null, expiresAt: { gt: now }, leaseUntil: { gt: now } },
    select: QR_SELECT,
  });
}

/** Whether a code can still be scanned (not claimed, not expired). Doesn't claim it. */
export async function peekQr(token: string) {
  return prisma.qrInviteToken.findFirst({
    where: { token, claimedAt: null, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, leaseUntil: { gt: new Date() } },
    select: { group: { select: { name: true } } },
  });
}

/**
 * Spend an anonymous claim (from the cookie) for the account that just logged in or signed up. Returns
 * legacy pending invite data, only while the QR is still live. New signups spend QRs atomically in signupService.
 */
export async function takeAnonymousClaim(claimSecret: string | null | undefined, userId: string) {
  if (!claimSecret) return null;
  const row = await prisma.qrInviteToken.findFirst({
    where: { claimSecret, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, leaseUntil: { gt: new Date() } },
    select: QR_SELECT,
  });
  if (!row) return null;
  const spent = await prisma.qrInviteToken.updateMany({
    where: { id: row.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, leaseUntil: { gt: new Date() } },
    data: { usedAt: new Date(), claimSecret: null, claimedById: userId },
  });
  if (spent.count !== 1) return null;
  return { pendingInviteCode: row.group.inviteCode, autoApprove: row.autoApprove, groupName: row.group.name };
}

export type QrJoinResult =
  | { ok: true; groupId: string; groupName: string; pending: boolean }
  | { ok: false; status: number; error: string };

/** Join the group with a code this user claimed (claims it first when they haven't yet). */
export async function joinWithQr(token: string, userId: string, nickname?: string | null): Promise<QrJoinResult> {
  // A member scanning their own group's code doesn't use it up.
  const target = await prisma.qrInviteToken.findUnique({ where: { token }, select: { groupId: true } });
  if (!target) return { ok: false, status: 410, error: QR_INVALID_MESSAGE };
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: target.groupId, userId } },
    select: { id: true },
  });
  if (existing) return { ok: false, status: 409, error: "이미 참가 중인 그룹입니다." };

  const row = await claimQrForUser(token, userId);
  if (!row) return { ok: false, status: 410, error: QR_INVALID_MESSAGE };

  const spent = await prisma.qrInviteToken.updateMany({ where: { id: row.id, usedAt: null, revokedAt: null,
    expiresAt: { gt: new Date() }, leaseUntil: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (spent.count !== 1) return { ok: false, status: 410, error: QR_INVALID_MESSAGE };

  const pending = !row.autoApprove;
  const member = await prisma.groupMember.create({
    data: {
      groupId: row.groupId,
      userId,
      nickname: nickname?.trim() || null,
      role: "MEMBER",
      status: pending ? "PENDING" : "ACTIVE",
    },
  });
  if (pending) {
    await createJoinRequestNotification({ id: member.id, groupId: row.groupId, userId });
  }
  eventBus.notify(row.groupId);
  return { ok: true, groupId: row.groupId, groupName: row.group.name, pending };
}
