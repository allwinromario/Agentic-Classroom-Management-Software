import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const classSchema = z.object({
  subject: z.string().min(1),
  room: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  dayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
  lateThresholdMins: z.number().int().min(1).max(60).optional().default(10),
});

const createSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  classes: z.array(classSchema).optional().default([]),
});

/** Self-migration: add lateThresholdMins column to classes if it doesn't exist yet.
 *  Silently no-ops if the column already exists (after prisma db push). */
async function ensureLateThresholdColumn() {
  // Check first to avoid the noisy Prisma error log on duplicate column
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA table_info(classes)`
  );
  const exists = cols.some((c) => c.name === "lateThresholdMins");
  if (!exists) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE classes ADD COLUMN lateThresholdMins INTEGER NOT NULL DEFAULT 10`
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureLateThresholdColumn();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let whereClause = {};
  if (auth.role === "STUDENT") {
    whereClause = { status: "APPROVED" };
  } else if (auth.role === "ADMIN") {
    whereClause = { createdById: auth.userId };
  } else if (status) {
    whereClause = { status };
  }

  const timetables = await prisma.timetable.findMany({
    where: whereClause,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      classes: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
    orderBy: { createdAt: "desc" },
  });

  // Enrich classes with lateThresholdMins via raw SQL (safe before & after db push)
  const allClassIds = timetables.flatMap((t) => t.classes.map((c) => c.id));
  if (allClassIds.length > 0) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; lateThresholdMins: number | bigint }[]>(
      `SELECT id, COALESCE(lateThresholdMins, 10) as lateThresholdMins FROM classes WHERE id IN (${allClassIds.map(() => "?").join(",")})`,
      ...allClassIds
    );
    // Prisma returns INTEGER columns as BigInt from raw queries — coerce to number
    const thMap = new Map(rows.map((r) => [r.id, Number(r.lateThresholdMins)]));
    for (const t of timetables) {
      for (const c of t.classes) {
        (c as typeof c & { lateThresholdMins: number }).lateThresholdMins = thMap.get(c.id) ?? 10;
      }
    }
  }

  return NextResponse.json({ timetables });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (auth.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Your account is not yet approved" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const data = createSchema.parse(body);

  await ensureLateThresholdColumn();

  const timetable = await prisma.timetable.create({
    data: {
      title: data.title,
      description: data.description,
      createdById: auth.userId,
    },
    include: {
      classes: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Insert classes with lateThresholdMins via raw SQL (safe before & after db push)
  if (data.classes.length > 0) {
    const { randomBytes } = await import("crypto");
    for (const c of data.classes) {
      const cid = "c" + randomBytes(11).toString("base64url").slice(0, 24);
      await prisma.$executeRawUnsafe(
        `INSERT INTO classes (id, subject, room, startTime, endTime, dayOfWeek, lateThresholdMins, timetableId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        cid, c.subject, c.room ?? null, c.startTime, c.endTime, c.dayOfWeek, c.lateThresholdMins, timetable.id
      );
    }
  }

  // Re-fetch with classes populated
  const full = await prisma.timetable.findUnique({
    where: { id: timetable.id },
    include: { classes: true, createdBy: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ timetable: full }, { status: 201 });
}
