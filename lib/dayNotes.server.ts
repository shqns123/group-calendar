import { prisma } from "@/lib/prisma";
import { canEditDayNote } from "@/lib/dayNotes";

type DayNoteAccess = {
  canRead: boolean;
  canEdit: boolean;
};

export async function getGroupDayNoteAccess(
  userId: string,
  groupId: string,
): Promise<DayNoteAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isOperator: true },
  });

  if (user?.isOperator) {
    return { canRead: true, canEdit: true };
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { leaderId: true },
  });

  if (!group) {
    return { canRead: false, canEdit: false };
  }

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true },
  });

  const isActiveMember = member?.status === "ACTIVE";
  const isGroupAdmin = group.leaderId === userId;

  return {
    canRead: isGroupAdmin || isActiveMember,
    canEdit: canEditDayNote({
      isGroupAdmin,
      memberRole: isActiveMember ? member.role : null,
    }),
  };
}
