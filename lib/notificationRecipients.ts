type MemberWithNotifications = {
  role?: string | null;
  status?: string | null;
};

export function isNotifiableGroupMember(member: MemberWithNotifications): boolean {
  return (member.status === "ACTIVE" || member.status == null) && member.role !== "OBSERVER";
}

export function filterNotifiableGroupMembers<T extends MemberWithNotifications>(members: T[]): T[] {
  return members.filter(isNotifiableGroupMember);
}
