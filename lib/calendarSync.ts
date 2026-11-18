import "server-only";

import { prisma } from "./prisma";
import { writeGroupCalendarJson } from "./attendanceReport";
import { uploadCalendarToGitLab } from "./gitlabCalendar";

export async function syncGroupCalendarToGitLab(groupId: string) {
  const calendar = await writeGroupCalendarJson(groupId);
  return uploadCalendarToGitLab(calendar);
}

export async function syncAllGroupCalendarsToGitLab() {
  // Groups with GitLab upload switched off are skipped.
  const groups = await prisma.group.findMany({ where: { calendarSyncEnabled: true }, select: { id: true } });
  const results = [];
  for (const group of groups) {
    results.push(await syncGroupCalendarToGitLab(group.id));
  }
  return results;
}
