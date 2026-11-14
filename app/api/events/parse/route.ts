import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseQuickAddWithAi, QuickAddAiError, seoulToday } from "@/lib/quickAddAi";

// POST /api/events/parse — AI reading of one quick-add line. Returns a draft only; the app shows
// it for confirmation and saves through POST /api/events as before.
// On any AI failure it answers 503 { fallback: true } and the app uses its own rule parser.

const MAX_TEXT = 200;
const PER_MINUTE = 20;
const recent = new Map<string, number[]>();

function rateLimited(userId: string) {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > PER_MINUTE;
}

const label = (m: { nickname: string | null; user: { name: string | null; email: string | null } }) =>
  m.nickname?.trim() || m.user.name?.trim() || m.user.email?.split("@")[0] || "";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const today = seoulToday();
  const selected = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : today;
  if (!groupId || !text) return Response.json({ error: "groupId와 text가 필요합니다" }, { status: 400 });
  if (text.length > MAX_TEXT) return Response.json({ error: `${MAX_TEXT}자 이내로 적어 주세요` }, { status: 400 });

  // Same access rule as reading the group's events.
  const [group, member] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { leaderId: true } }),
    prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } }),
  ]);
  if (!group) return Response.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });
  if (group.leaderId !== userId && (!member || member.status !== "ACTIVE")) {
    return Response.json({ error: "접근 권한이 없습니다" }, { status: 403 });
  }

  if (rateLimited(userId)) return Response.json({ error: "잠시 후 다시 시도해 주세요", fallback: true }, { status: 429 });

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true, nickname: true, status: true, role: true, user: { select: { name: true, email: true } } },
  });
  // Roster = who can be put on an event (same rule as the app: active, not observers).
  const roster = members.filter((m) => (m.status === "ACTIVE" || m.status == null) && m.role !== "OBSERVER").map(label).filter(Boolean);
  const mine = members.find((m) => m.userId === userId);
  const me = mine ? label(mine) : session.user?.name?.trim() || "";

  // Recent trip titles: the model fixes place-name typos against these ("남영연구소" → "남양연구소").
  const since = new Date(Date.now() - 180 * 86_400_000);
  const events = await prisma.event.findMany({
    where: { groupId, category: "BUSINESS_TRIP", startDate: { gte: since } },
    select: { title: true },
    orderBy: { startDate: "desc" },
    take: 200,
  });
  const recentTitles = [...new Set(events.map((e) => e.title.trim()).filter(Boolean))].slice(0, 30);

  try {
    const draft = await parseQuickAddWithAi({ text, today, selected, me, roster, recentTitles });
    return Response.json({ draft });
  } catch (e) {
    const reason = e instanceof QuickAddAiError ? e.reason : "upstream";
    console.error("[quick-add ai]", reason, e instanceof Error ? e.message : e);
    return Response.json({ error: "AI 해석을 쓸 수 없어요", reason, fallback: true }, { status: 503 });
  }
}
