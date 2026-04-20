import cron from "node-cron";
import { prisma } from "./prisma";
import { sendPushToUser } from "./webpush";

export function startScheduler() {
  // 매 분마다 체크
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const currentDay = now.getDay();     // 0=일, 1=월, ..., 6=토
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

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
              include: { user: { include: { pushSubscriptions: true } } },
            },
          },
        },
      },
    });

    for (const schedule of schedules) {
      const days = schedule.dayOfWeek.split(",").map(Number);
      if (!days.includes(currentDay)) continue;

      const allSubs = schedule.group.members.flatMap(
        (m) => m.user.pushSubscriptions
      );

      if (allSubs.length > 0) {
        await sendPushToUser(allSubs, {
          title: schedule.group.name,
          body: schedule.message,
          url: "/",
        });
      }
    }
  });
}
