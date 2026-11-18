import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultMonthlyLimit, seoulDay, seoulMonthStart } from "@/lib/aiUsage";

// GET /api/admin/ai-usage?days=30 — operator only.
// Per-user calls/cost (this Seoul month and all time), each user's monthly cap, and per-day
// calls/cost over the last `days` days for everyone and for each user (for the line charts).

const RANGES = [7, 30, 90, 180];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isOperator: true } });
  if (!me?.isOperator) return Response.json({ error: "Forbidden" }, { status: 403 });

  const asked = Number(new URL(req.url).searchParams.get("days"));
  const days = RANGES.includes(asked) ? asked : 30;

  // Day keys oldest → today (Seoul); the range starts at Seoul midnight `days - 1` days ago.
  const today = seoulDay(new Date());
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const since = new Date(new Date(`${dayKeys[0]}T00:00:00Z`).getTime() - 9 * 3_600_000);
  const month = seoulMonthStart();

  const [users, limits, monthly, total, rows] = await Promise.all([
    prisma.user.findMany({
      where: { status: { not: "DELETED" } },
      select: { id: true, name: true, email: true, image: true, isOperator: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.aiUsageLimit.findMany({ select: { userId: true, monthlyLimit: true } }),
    prisma.aiUsage.groupBy({ by: ["userId"], where: { createdAt: { gte: month.start } }, _count: { _all: true }, _sum: { cost: true } }),
    prisma.aiUsage.groupBy({ by: ["userId"], _count: { _all: true }, _sum: { cost: true } }),
    prisma.aiUsage.findMany({ where: { createdAt: { gte: since } }, select: { userId: true, createdAt: true, cost: true } }),
  ]);

  const index = new Map(dayKeys.map((k, i) => [k, i]));
  const blank = () => ({ calls: dayKeys.map(() => 0), cost: dayKeys.map(() => 0) });
  const all = blank();
  const perUser: Record<string, ReturnType<typeof blank>> = {};
  for (const r of rows) {
    const i = index.get(seoulDay(r.createdAt));
    if (i === undefined) continue;
    const u = (perUser[r.userId] ??= blank());
    all.calls[i]++;
    all.cost[i] += r.cost;
    u.calls[i]++;
    u.cost[i] += r.cost;
  }

  const limitOf = new Map(limits.map((l) => [l.userId, l.monthlyLimit]));
  const monthOf = new Map(monthly.map((m) => [m.userId, m]));
  const totalOf = new Map(total.map((t) => [t.userId, t]));
  const fallback = defaultMonthlyLimit();

  const people = users.map((u) => ({ id: u.id, name: u.name, email: u.email, image: u.image, isOperator: u.isOperator, deleted: false }));
  // Usage from accounts that no longer exist still counts toward the totals.
  const known = new Set(people.map((p) => p.id));
  for (const t of total) {
    if (!known.has(t.userId)) people.push({ id: t.userId, name: null, email: null, image: null, isOperator: false, deleted: true });
  }

  return Response.json({
    month: month.label,
    defaultLimit: fallback,
    days: dayKeys,
    series: all,
    perUser,
    users: people.map((p) => ({
      ...p,
      monthCalls: monthOf.get(p.id)?._count._all ?? 0,
      monthCost: monthOf.get(p.id)?._sum.cost ?? 0,
      totalCalls: totalOf.get(p.id)?._count._all ?? 0,
      totalCost: totalOf.get(p.id)?._sum.cost ?? 0,
      customLimit: limitOf.get(p.id) ?? null,
      limit: limitOf.get(p.id) ?? fallback,
    })),
  });
}
