// What the signed-in user may do in the selected group — the same rules the
// server enforces (see app/api/** and lib/groupPermissions*.ts in the web app).
// Screens use this only to decide what to show; the server still checks every call.

import type { Group, Me } from "./types";

export type Permissions = {
  isOperator: boolean;
  isGroupAdmin: boolean; // the group's leaderId (created/owns the group)
  isLeaderRole: boolean; // 그룹장 / 파트장
  isObserver: boolean;
  canWriteEvents: boolean;
  canEditDayNote: boolean;
  canApproveJoin: boolean; // approve/reject join requests
  canChangeRoles: boolean;
  canRemoveMembers: boolean; // group admin or operator (server: DELETE members/[id])
  canAddMembers: boolean; // operators add any user directly; others invite by code
  canGrantNotify: boolean; // only the group admin
  canTransferAdmin: boolean; // only the group admin (operators use their own route)
  canEditGroup: boolean;
  canInviteCode: boolean; // regenerate invite code
  canQrInvite: boolean;
  canCalendarSync: boolean;
  canNotify: boolean; // send now + schedules
  anyGroupManagement: boolean;
};

export function permissionsFor(group: Group | null, me: Me | null): Permissions {
  const isOperator = !!me?.isOperator;
  const mine = group?.members.find((m) => m.userId === me?.id);
  const active = mine?.status === "ACTIVE";
  const isGroupAdmin = !!group && !!me && group.leaderId === me.id;
  const isLeaderRole = active && (mine?.role === "그룹장" || mine?.role === "파트장");
  const isObserver = active && mine?.role === "OBSERVER";

  const p: Permissions = {
    isOperator,
    isGroupAdmin,
    isLeaderRole,
    isObserver,
    canWriteEvents: !!group && !isObserver && (active || isGroupAdmin || isOperator),
    canEditDayNote: isOperator || isGroupAdmin || (active && (mine?.role === "ADMIN" || isLeaderRole)),
    canApproveJoin: isGroupAdmin || isOperator || isLeaderRole,
    canChangeRoles: isGroupAdmin || isOperator,
    canRemoveMembers: isGroupAdmin || isOperator,
    canAddMembers: isOperator,
    canGrantNotify: isGroupAdmin,
    canTransferAdmin: isGroupAdmin || isOperator,
    canEditGroup: isGroupAdmin || isOperator,
    canInviteCode: isGroupAdmin || isLeaderRole,
    canQrInvite: isGroupAdmin || isOperator || isLeaderRole,
    canCalendarSync: isGroupAdmin || isOperator || isLeaderRole,
    canNotify: isGroupAdmin || (active && !!mine?.canNotify),
    anyGroupManagement: false,
  };
  p.anyGroupManagement = !!group && (p.canApproveJoin || p.canEditGroup || p.canInviteCode || p.canQrInvite || p.canNotify || p.canCalendarSync);
  return p;
}

export const ROLE_LABEL: Record<string, string> = {
  그룹장: "그룹장",
  파트장: "파트장",
  MEMBER: "멤버",
  OBSERVER: "옵저버",
  ADMIN: "관리자",
};

export function roleLabel(role?: string | null) {
  return (role && ROLE_LABEL[role]) || "멤버";
}
