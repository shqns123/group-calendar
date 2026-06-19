export function isLeaderRole(role: string | null | undefined): boolean {
  return role === "그룹장" || role === "파트장";
}

export function isObserverRole(role: string | null | undefined): boolean {
  return role === "OBSERVER";
}

export function shouldCountTowardTotals(member: {
  role?: string | null;
  status?: string | null;
}): boolean {
  return (member.status === "ACTIVE" || member.status == null) && !isObserverRole(member.role);
}
