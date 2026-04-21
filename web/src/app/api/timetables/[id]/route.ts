import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const classSchema = z.object({
  subject: z.string().min(1),
  room: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  dayOfWeek: z.string(),
  lateThresholdMins: z.number().int().min(1).max(60).optional().default(10),
});

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]).optional(),
  classes: z.array(classSchema).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const timetable = await prisma.timetable.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      classes: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  });

  if (!timetable) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    auth.role === "STUDENT" &&
    timetable.status !== "APPROVED"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ timetable });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data = updateSchema.parse(body);

  const existing = await prisma.timetable.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.role === "ADMIN" && existing.createdById !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (auth.role === "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (auth.role === "ADMIN" && data.status && !["DRAFT", "PENDING_APPROVAL"].includes(data.status)) {
    return NextResponse.json({ error: "Admin can only move to DRAFT or PENDING_APPROVAL" }, { status: 403 });
  }

  const { classes, ...timetableData } = data;

  const hasContentUpdate =
    classes !== undefined ||
    data.title !== undefined ||
    data.description !== undefined;

  // Approved timetables must go back through workflow when content changes
  if (
    auth.role === "ADMIN" &&
    existing.status === "APPROVED" &&
    hasContentUpdate &&
    (!data.status || !["DRAFT", "PENDING_APPROVAL"].includes(data.status))
  ) {
    return NextResponse.json(
      {
        error:
          "This timetable is approved. To save changes, resubmit as Draft or Pending approval.",
      },
      { status: 400 }
    );
  }

  // Replace all classes if provided (delete-then-recreate is simplest for SQLite)
  if (classes !== undefined) {
    await prisma.class.deleteMany({ where: { timetableId: id } });
    if (classes.length > 0) {
      // Use raw SQL so lateThresholdMins is persisted even before `prisma db push`
      const { randomBytes } = await import("crypto");
      for (const c of classes) {
        const cid = "c" + randomBytes(11).toString("base64url").slice(0, 24);
        await prisma.$executeRawUnsafe(
          `INSERT INTO classes (id, subject, room, startTime, endTime, dayOfWeek, lateThresholdMins, timetableId, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          cid, c.subject, c.room ?? null, c.startTime, c.endTime, c.dayOfWeek, c.lateThresholdMins, id
        );
      }
    }
  }

  const timetable = await prisma.timetable.update({
    where: { id },
    data: timetableData,
    include: {
      classes: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ timetable });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.timetable.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.role === "ADMIN" && existing.createdById !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (auth.role === "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.timetable.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
