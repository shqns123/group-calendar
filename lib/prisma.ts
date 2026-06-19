import "server-only";

import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDatasourceUrl() {
  const rawValue = process.env.DATABASE_URL?.trim().replace(/^"(.*)"$/, "$1");
  if (rawValue) {
    if (!rawValue.startsWith("file:")) {
      return rawValue;
    }

    const filePath = rawValue.slice("file:".length);
    if (filePath.startsWith("./") || filePath.startsWith("../")) {
      const absolutePath = path.resolve(process.cwd(), "prisma", filePath);
      return `file:${absolutePath.replace(/\\/g, "/")}`;
    }

    return rawValue;
  }

  const fallbackPath = path.resolve(process.cwd(), "prisma", "prisma", "dev.db");
  return `file:${fallbackPath.replace(/\\/g, "/")}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatasourceUrl(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
