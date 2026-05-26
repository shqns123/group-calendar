import dotenv from "dotenv";
import fs from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  isLegacyOvertimeMigrationCandidate,
  normalizeLegacyOvertimeDate,
} from "../lib/legacyOvertimeMigration.ts";

if (fs.existsSync(".env")) {
  dotenv.config({ path: ".env" });
}

if (!process.env.DATABASE_URL && fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}

if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const prisma = new PrismaClient();

async function main() {
  const overtimeEvents = await prisma.event.findMany({
    where: {
      allDay: true,
      isOvertimeOnly: true,
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const legacyEvents = overtimeEvents.filter((event) =>
    isLegacyOvertimeMigrationCandidate({
      allDay: true,
      isOvertimeOnly: true,
      startDate: event.startDate,
      endDate: event.endDate,
    }),
  );

  if (legacyEvents.length === 0) {
    console.log("No legacy overtime events needed date correction.");
    return;
  }

  console.log(`Fixing ${legacyEvents.length} legacy overtime event(s)...`);

  await prisma.$transaction(
    legacyEvents.map((event) =>
      prisma.event.update({
        where: { id: event.id },
        data: {
          startDate: normalizeLegacyOvertimeDate(event.startDate),
          endDate: normalizeLegacyOvertimeDate(event.endDate),
        },
      }),
    ),
  );

  for (const event of legacyEvents) {
    console.log(
      `${event.id} | ${event.title} | ${event.startDate.toISOString()} -> ${normalizeLegacyOvertimeDate(event.startDate).toISOString()}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
