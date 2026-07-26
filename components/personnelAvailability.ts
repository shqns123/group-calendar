"use client";

import { shouldCountTowardTotals } from "@/lib/groupPermissions";

export type PersonnelMember = {
  userId: string;
  nickname?: string | null;
  role?: string | null;
  status?: string | null;
  user: {
    name?: string | null;
    email?: string | null;
  };
};

export type PersonnelGroup = {
  members: PersonnelMember[];
};

export type PersonnelAvailability = {
  totalMembers: number;
  assignedMembers: string[];
  remainingMembers: string[];
};

function getMemberLabel(member: PersonnelMember) {
  return (
    member.nickname?.trim() ||
    member.user.name?.trim() ||
    member.user.email?.split("@")[0] ||
    "이름 없음"
  );
}

function parsePersonnel(raw?: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getPersonnelAvailability(
  group: PersonnelGroup | null,
  events: Array<{
    personnel?: string | null;
    equipmentOnly?: boolean;
    creatorId: string;
    creator: { name?: string | null; email?: string | null };
  }>
) {
  if (!group) return null;

  const activeMembers = group.members.filter((member) => shouldCountTowardTotals(member));
  const roster = activeMembers.map((member) => getMemberLabel(member));
  const rosterSet = new Set(roster);
  const assignedSet = new Set<string>();

  for (const event of events) {
    if (event.equipmentOnly) continue;
    const labels = parsePersonnel(event.personnel);
    const resolvedLabels =
      labels.length > 0
        ? labels
        : [event.creator.name?.trim() || event.creator.email?.split("@")[0] || "이름 없음"];

    for (const label of resolvedLabels) {
      if (rosterSet.has(label)) {
        assignedSet.add(label);
      }
    }
  }

  const assignedMembers = roster.filter((label) => assignedSet.has(label));
  const remainingMembers = roster.filter((label) => !assignedSet.has(label));

  return {
    totalMembers: roster.length,
    assignedMembers,
    remainingMembers,
  } satisfies PersonnelAvailability;
}
