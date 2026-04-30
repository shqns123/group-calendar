import { prisma } from "./prisma";

export function isLeaderRole(role: string | null | undefined): boolean {
  return role === "그룹장" || role === "파트장";
}

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
