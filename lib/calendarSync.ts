import "server-only";

import { prisma } from "./prisma";
import { writeGroupCalendarJson } from "./attendanceReport";
import { uploadCalendarToGitLab } from "./gitlabCalendar";

export async function syncGroupCalendarToGitLab(groupId: string) {
  const calendar = await writeGroupCalendarJson(groupId);
  return uploadCalendarToGitLab(calendar);
}

export async function syncAllGroupCalendarsToGitLab() {
  const groups = await prisma.group.findMany({ select: { id: true } });
  const results = [];
  for (const group of groups) {
    results.push(await syncGroupCalendarToGitLab(group.id));
  }
  return results;
}
