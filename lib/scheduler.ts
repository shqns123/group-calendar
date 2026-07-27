import cron from "node-cron";
import { sendDailyAttendanceReport } from "./attendanceReport";
import { sendMobilePushToTokens } from "./mobilepush";
import { prisma } from "./prisma";
import { SEOUL_TIME_ZONE, getSeoulWeekday, formatSeoulTimeLabel } from "./seoulTime";
import { sendPushToUser } from "./webpush";

let schedulerStarted = false;
let attendanceReportRunning = false;

function parseAttendanceReportTimes(
  rawTimes: string | null,
  fallbackHour: number,
  fallbackMinute: number,
) {
  if (!rawTimes) {
    return [`${String(fallbackHour).padStart(2, "0")}:${String(fallbackMinute).padStart(2, "0")}`];
  }

  try {
    const parsed = JSON.parse(rawTimes) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is string => typeof value === "string" && /^\d{2}:\d{2}$/.test(value));
  } catch {
    return [];
  }
}

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

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
    "* * * * *",
    async () => {
      if (attendanceReportRunning) return;
      attendanceReportRunning = true;

      try {
        const now = new Date();
        const currentTime = formatSeoulTimeLabel(now);
        const groups = await prisma.group.findMany({
          where: { attendanceReportEnabled: true },
          select: {
            id: true,
            attendanceReportTo: true,
            attendanceReportHour: true,
            attendanceReportMinute: true,
            attendanceReportTimes: true,
          },
        });

        for (const group of groups) {
          const reportTimes = parseAttendanceReportTimes(
            group.attendanceReportTimes,
            group.attendanceReportHour,
            group.attendanceReportMinute,
          );
          if (!reportTimes.includes(currentTime)) continue;

          await sendDailyAttendanceReport(now, {
            groupId: group.id,
            to: group.attendanceReportTo,
          });
        }
      } catch (error) {
        console.error("[scheduler] attendance report failed", error);
      } finally {
        attendanceReportRunning = false;
      }
    },
    { timezone: SEOUL_TIME_ZONE },
  );
}
