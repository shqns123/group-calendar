import { prisma } from "@/lib/prisma";

export async function canManageGroupNotifications(userId: string, groupId: string): Promise<boolean> {
  const leader = await prisma.group.findFirst({
    where: { id: groupId, leaderId: userId },
    select: { id: true },
  });
  if (leader) return true;

  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId, canNotify: true, status: "ACTIVE" },
    select: { id: true },
  });
  return !!member;
}
