import cron from "node-cron";
import { sendMobilePushToTokens } from "./mobilepush";
import { prisma } from "./prisma";
import { getSeoulWeekday, formatSeoulTimeLabel } from "./seoulTime";
import { sendPushToUser } from "./webpush";

let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  cron.schedule("* * * * *", async () => {
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
  });
}
