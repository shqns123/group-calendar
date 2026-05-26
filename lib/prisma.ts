import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function readEnvFileValue(filePath: string, key: string) {
  if (!fs.existsSync(filePath)) return undefined;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const currentKey = trimmed.slice(0, separatorIndex).trim();
    if (currentKey !== key) continue;

    return trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, "$1");
  }

  return undefined;
}

function resolveDatabaseUrl() {
  const fromProcess = process.env.DATABASE_URL?.trim().replace(/^"(.*)"$/, "$1");
  const fromLocalFile = readEnvFileValue(
    path.join(process.cwd(), ".env.local"),
    "DATABASE_URL",
  );
  const fromEnvFile = readEnvFileValue(
    path.join(process.cwd(), ".env"),
    "DATABASE_URL",
  );

  return fromProcess || fromLocalFile || fromEnvFile;
}

function normalizeDatabaseUrl(rawValue: string | undefined) {
  if (!rawValue) {
    throw new Error("DATABASE_URL is not configured.");
  }

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

const datasourceUrl = normalizeDatabaseUrl(resolveDatabaseUrl());

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
