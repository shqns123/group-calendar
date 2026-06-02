import { auth } from "@/lib/auth";
import {
  createDayNoteEntry,
  expandDayNoteDateRange,
  normalizeDayNoteEntries,
  parseDayNoteEntries,
  type DayNoteEntry,
  serializeDayNoteEntries,
} from "@/lib/dayNotes";
import { getGroupDayNoteAccess } from "@/lib/dayNotes.server";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function validateDateKey(date: string | null): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function toNoteResponse(
  note: {
    id: string;
    date: string;
    content: string;
    updatedAt: Date;
  } | null,
) {
  if (!note) return null;

  return {
    id: note.id,
    date: note.date,
    content: note.content,
    items: parseDayNoteEntries(note.content, note.date),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function normalizeIncomingEntries(rawEntries: unknown[], fallbackDate: string): DayNoteEntry[] {
  const entries = rawEntries.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<DayNoteEntry>;
    return [
      createDayNoteEntry(fallbackDate, {
        id: typeof candidate.id === "string" ? candidate.id : `entry-${index}-${Date.now()}`,
        text: typeof candidate.text === "string" ? candidate.text : "",
        startDate: typeof candidate.startDate === "string" ? candidate.startDate : fallbackDate,
        endDate: typeof candidate.endDate === "string" ? candidate.endDate : fallbackDate,
      }),
    ];
  });

  return normalizeDayNoteEntries(entries, fallbackDate);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const date = searchParams.get("date");

  if (!groupId || !validateDateKey(date)) {
    return Response.json({ error: "groupId와 date가 필요합니다" }, { status: 400 });
  }

  const access = await getGroupDayNoteAccess(session.user.id, groupId);
  if (!access.canRead) {
    return Response.json({ error: "조회 권한이 없습니다" }, { status: 403 });
  }

  const note = await prisma.groupDayNote.findUnique({
    where: { groupId_date: { groupId, date } },
    select: {
      id: true,
      date: true,
      content: true,
      updatedAt: true,
    },
  });

  return Response.json({
    note: toNoteResponse(note),
    canEdit: access.canEdit,
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const groupId = typeof body.groupId === "string" ? body.groupId : null;
  const date = typeof body.date === "string" ? body.date : null;
  const rawEntries = Array.isArray(body.entries) ? body.entries : [];

  if (!groupId || !validateDateKey(date)) {
    return Response.json({ error: "groupId와 date가 필요합니다" }, { status: 400 });
  }

  const access = await getGroupDayNoteAccess(session.user.id, groupId);
  if (!access.canEdit) {
    return Response.json({ error: "업무내용 수정 권한이 없습니다" }, { status: 403 });
  }

  const incomingEntries = normalizeIncomingEntries(rawEntries, date);

  if (incomingEntries.some((entry) => entry.text.length > 200)) {
    return Response.json({ error: "각 업무내용은 200자 이하로 입력해 주세요" }, { status: 400 });
  }

  if (incomingEntries.length > 20) {
    return Response.json({ error: "업무내용은 최대 20개까지 등록할 수 있습니다" }, { status: 400 });
  }

  const currentNote = await prisma.groupDayNote.findUnique({
    where: { groupId_date: { groupId, date } },
    select: {
      id: true,
      date: true,
      content: true,
      updatedAt: true,
    },
  });

  const previousEntries = parseDayNoteEntries(currentNote?.content ?? null, date);
  const editedEntryIds = new Set([
    ...previousEntries.map((entry) => entry.id),
    ...incomingEntries.map((entry) => entry.id),
  ]);

  const affectedDates = Array.from(
    new Set([
      ...previousEntries.flatMap((entry) => expandDayNoteDateRange(entry.startDate, entry.endDate)),
      ...incomingEntries.flatMap((entry) => expandDayNoteDateRange(entry.startDate, entry.endDate)),
    ]),
  );

  if (affectedDates.length === 0) {
    await prisma.groupDayNote.deleteMany({
      where: { groupId, date },
    });

    return Response.json({
      note: null,
      canEdit: true,
    });
  }

  const existingNotes = await prisma.groupDayNote.findMany({
    where: {
      groupId,
      date: { in: affectedDates },
    },
    select: {
      id: true,
      date: true,
      content: true,
      updatedAt: true,
    },
  });

  const existingByDate = new Map(existingNotes.map((note) => [note.date, note]));

  await prisma.$transaction(async (tx) => {
    for (const targetDate of affectedDates) {
      const existing = existingByDate.get(targetDate) ?? null;
      const retainedEntries = parseDayNoteEntries(existing?.content ?? null, targetDate).filter(
        (entry) => !editedEntryIds.has(entry.id),
      );
      const entriesForDate = incomingEntries.filter(
        (entry) => targetDate >= entry.startDate && targetDate <= entry.endDate,
      );
      const nextEntries = [...retainedEntries, ...entriesForDate];
      const serialized = serializeDayNoteEntries(nextEntries, targetDate);

      if (!serialized) {
        if (existing) {
          await tx.groupDayNote.delete({
            where: { groupId_date: { groupId, date: targetDate } },
          });
        }
        continue;
      }

      await tx.groupDayNote.upsert({
        where: { groupId_date: { groupId, date: targetDate } },
        update: {
          content: serialized,
          updatedById: session.user.id,
        },
        create: {
          groupId,
          date: targetDate,
          content: serialized,
          createdById: session.user.id,
          updatedById: session.user.id,
        },
      });
    }
  });

  const refreshedNote = await prisma.groupDayNote.findUnique({
    where: { groupId_date: { groupId, date } },
    select: {
      id: true,
      date: true,
      content: true,
      updatedAt: true,
    },
  });

  return Response.json({
    note: toNoteResponse(refreshedNote),
    canEdit: true,
  });
}
