import "server-only";

import { prisma } from "@/lib/prisma";
import type { AiCallUsage } from "@/lib/quickAddAi";

// AI usage records and per-user caps (operator page: /admin/ai-usage).
//
// Cap: calls per user per Seoul calendar month. Every request that reached OpenRouter counts,
// failed ones too (they can still be billed). AI_QUICK_ADD_MONTHLY_LIMIT sets the default cap;
// an operator can set a different cap per user (AiUsageLimit). 0 turns the AI off for that user.

export const DEFAULT_MONTHLY_LIMIT = 300;

/**
 * USD per 1M tokens, used only when OpenRouter's response has no cost.
 * Claude Haiku 5.5: $0.10 in / $0.50 out (prompts up to 100K tokens; ours are ~2K).
 */
export const AI_PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "anthropic/claude-haiku-5.5": { input: 0.1, output: 0.5 },
};
const FALLBACK_PRICE = AI_PRICES_PER_MTOK["anthropic/claude-haiku-5.5"];

export function defaultMonthlyLimit() {
  const raw = Number(process.env.AI_QUICK_ADD_MONTHLY_LIMIT);
  return Number.isInteger(raw) && raw >= 0 ? raw : DEFAULT_MONTHLY_LIMIT;
}

const SEOUL_MS = 9 * 3_600_000;

/** Start of the current Seoul calendar month as a UTC instant, and its "YYYY-MM" label. */
export function seoulMonthStart(now = new Date()) {
  const s = new Date(now.getTime() + SEOUL_MS);
  const start = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1) - SEOUL_MS);
  return { start, label: `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}` };
}

/** Seoul calendar day "YYYY-MM-DD" of an instant. */
export function seoulDay(d: Date) {
  return new Date(d.getTime() + SEOUL_MS).toISOString().slice(0, 10);
}

export async function monthlyLimitFor(userId: string) {
  const row = await prisma.aiUsageLimit.findUnique({ where: { userId }, select: { monthlyLimit: true } });
  return row?.monthlyLimit ?? defaultMonthlyLimit();
}

/** Calls this month, the cap, and whether another call is allowed. */
export async function checkMonthlyLimit(userId: string) {
  const { start } = seoulMonthStart();
  const [used, limit] = await Promise.all([
    prisma.aiUsage.count({ where: { userId, createdAt: { gte: start } } }),
    monthlyLimitFor(userId),
  ]);
  return { used, limit, allowed: used < limit };
}

function priceOf(usage: AiCallUsage) {
  const p = AI_PRICES_PER_MTOK[usage.model] ?? FALLBACK_PRICE;
  return (usage.inputTokens * p.input + usage.outputTokens * p.output) / 1_000_000;
}

/** Saves one call. Never throws: a failed write must not break quick add. */
export async function recordAiUsage(userId: string, usage: AiCallUsage, status = "ok") {
  const reported = typeof usage.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0;
  try {
    await prisma.aiUsage.create({
      data: {
        userId,
        feature: "quick_add",
        model: usage.model.slice(0, 100),
        status,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cost: reported ? usage.cost! : priceOf(usage),
        costSource: reported ? "openrouter" : "estimate",
      },
    });
  } catch (e) {
    console.error("[ai usage] record failed", e instanceof Error ? e.message : e);
  }
}
