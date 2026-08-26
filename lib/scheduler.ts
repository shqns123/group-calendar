import cron from "node-cron";
import { syncAllGroupCalendarsToGitLab } from "./calendarSync";
import { sendMobilePushToTokens } from "./mobilepush";
import { prisma } from "./prisma";
import { SEOUL_TIME_ZONE, getSeoulWeekday, formatSeoulTimeLabel } from "./seoulTime";
import { sendPushToUser } from "./webpush";

let schedulerStarted = false;
let calendarSyncRunning = false;

async function runCalendarSync() {
  if (calendarSyncRunning) return;
  calendarSyncRunning = true;

  try {
    const results = await syncAllGroupCalendarsToGitLab();
    for (const result of results) {
      console.info(`[calendar-sync] ${result.action} ${result.fileName} (${result.count} events)`);
    }
  } catch (error) {
    console.error("[calendar-sync] GitLab upload failed", error);
  } finally {
    calendarSyncRunning = false;
  }
}

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (process.env.GITLAB_PROJECT_ID && process.env.GITLAB_ACCESS_TOKEN) {
    void runCalendarSync();
  } else {
    console.warn("[calendar-sync] disabled: GITLAB_PROJECT_ID or GITLAB_ACCESS_TOKEN is missing");
  }

  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const now = new Date();
        const currentDay = getSeoulWeekday(now);
        const [currentHour, currentMin] = formatSeoulTimeLabel(now).split(":").map(Number);

        const schedules = await prisma.notificationSchedule.findMany({
          where: {
            active: true,
            timeHour: currentHour,
            timeMin: currentMin,
          },
          include: {
            group: {
              include: {
                members: {
                  where: { status: "ACTIVE" },
                  include: { user: { include: { pushSubscriptions: true, mobileDeviceTokens: true } } },
                },
              },
            },
          },
        });

        for (const schedule of schedules) {
          const days = schedule.dayOfWeek.split(",").map(Number);
          if (!days.includes(currentDay)) continue;

          const allSubs = schedule.group.members.flatMap((member) => member.user.pushSubscriptions);
          const allMobileTokens = schedule.group.members.flatMap((member) =>
            member.user.mobileDeviceTokens.map((device) => device.token),
          );

          if (allSubs.length > 0) {
            await sendPushToUser(allSubs, {
              title: schedule.group.name,
              body: schedule.message,
              url: `/?groupId=${schedule.group.id}`,
            });
          }
          if (allMobileTokens.length > 0) {
            await sendMobilePushToTokens(allMobileTokens, {
              title: schedule.group.name,
              body: schedule.message,
              url: `/?groupId=${schedule.group.id}`,
            });
          }
        }
      } catch (error) {
        console.error("[scheduler] notification schedule failed", error);
      }
    },
    { timezone: SEOUL_TIME_ZONE },
  );

  cron.schedule(
    process.env.GITLAB_SYNC_CRON?.trim() || "*/30 * * * *",
    runCalendarSync,
    { timezone: SEOUL_TIME_ZONE },
  );
}
