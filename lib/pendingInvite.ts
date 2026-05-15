import { prisma } from "@/lib/prisma";

type PendingInviteResult =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "exists"; groupName: string }
  | { status: "created"; groupName: string; autoApproved: boolean };

export async function consumePendingInviteForUser(userId: string): Promise<PendingInviteResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      pendingInviteCode: true,
      pendingInviteAutoApprove: true,
    },
  });

  const inviteCode = user?.pendingInviteCode?.trim();
  if (!user || !inviteCode) {
    return { status: "none" };
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode },
    select: { id: true, name: true },
  });

  if (!group) {
    await prisma.user.update({
      where: { id: userId },
      data: { pendingInviteCode: null, pendingInviteAutoApprove: false },
    });
    return { status: "invalid" };
  }

  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });

  if (existingMember) {
    await prisma.user.update({
      where: { id: userId },
      data: { pendingInviteCode: null, pendingInviteAutoApprove: false },
    });
    return { status: "exists", groupName: group.name };
  }

  const autoApproved = !!user.pendingInviteAutoApprove;

  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId,
      nickname: user.name?.trim() || null,
      role: "MEMBER",
      status: autoApproved ? "ACTIVE" : "PENDING",
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { pendingInviteCode: null, pendingInviteAutoApprove: false },
  });

  return { status: "created", groupName: group.name, autoApproved };
}
