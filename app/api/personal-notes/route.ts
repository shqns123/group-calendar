import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function isDateKey(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

type PersonalNoteItem = { id: string; text: string };

function parseItems(content: string): PersonalNoteItem[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const candidate = item as Partial<PersonalNoteItem>;
        if (typeof candidate.text !== "string" || !candidate.text.trim()) return [];
        return [{ id: typeof candidate.id === "string" ? candidate.id : `memo-${index}`, text: candidate.text.trim() }];
      });
    }
  } catch {
    // Legacy single-note values are shown as one memo item.
  }

  return content.trim() ? [{ id: "legacy", text: content.trim() }] : [];
}

function normalizeItems(value: unknown): PersonalNoteItem[] | null {
  if (!Array.isArray(value)) return null;

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<PersonalNoteItem>;
    const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
    if (!text) return [];
    return [{ id: typeof candidate.id === "string" && candidate.id ? candidate.id : `memo-${Date.now()}-${index}`, text }];
  });
}

function toNoteResponse(note: { id: string; date: string; content: string; updatedAt: Date } | null) {
  return note && { ...note, items: parseItems(note.content), updatedAt: note.updatedAt.toISOString() };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date");
  if (!isDateKey(date)) {
    return Response.json({ error: "date가 필요합니다" }, { status: 400 });
  }

  const note = await prisma.personalDayNote.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
    select: { id: true, date: true, content: true, updatedAt: true },
  });

  return Response.json({
    note: toNoteResponse(note),
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const date = typeof body.date === "string" ? body.date : null;
  const items = normalizeItems(body.items);

  if (!isDateKey(date) || items === null) {
    return Response.json({ error: "날짜와 메모 목록을 입력해 주세요" }, { status: 400 });
  }
  if (items.length > 20) {
    return Response.json({ error: "메모는 최대 20개까지 등록할 수 있습니다" }, { status: 400 });
  }
  if (items.some((item) => item.text.length > 1_000)) {
    return Response.json({ error: "각 메모는 1,000자 이하로 입력해 주세요" }, { status: 400 });
  }
  if (items.length === 0) {
    await prisma.personalDayNote.deleteMany({ where: { userId: session.user.id, date } });
    return Response.json({ note: null });
  }

  const content = JSON.stringify(items);

  const note = await prisma.personalDayNote.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    update: { content },
    create: { userId: session.user.id, date, content },
    select: { id: true, date: true, content: true, updatedAt: true },
  });

  return Response.json({ note: toNoteResponse(note) });
}
