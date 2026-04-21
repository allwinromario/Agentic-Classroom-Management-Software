import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyClassUpdated } from "@/app/api/attendance/stream/route";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const JS_TO_DAYOFWEEK = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"] as const;

/** Parse "HH:MM" string into a Date on today's calendar date. */
function parseClassTime(hhMm: string): Date {
  const [h, m] = hhMm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

const markSchema = z.object({
  classId: z.string(),
  studentId: z.string().optional(),     // admin specifies; student = self
  status: z.enum(["PRESENT", "ABSENT", "LATE"]),
  remarks: z.string().optional(),
  verifiedByFace: z.boolean().optional(), // true when face scan confirmed identity
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationName: z.string().optional(),
  teacherSave: z.boolean().optional(),  // true when teacher clicks Save — stamps savedAt
});

// Self-migrate: add savedAt column if it doesn't exist yet
async function ensureSavedAtColumn() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE attendances ADD COLUMN savedAt DATETIME`);
  } catch {
    // Column already exists — ignore
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSavedAtColumn();

  const body = await req.json();
  const data = markSchema.parse(body);

  const isStudent = auth.role === "STUDENT";
  const isAdmin   = auth.role === "ADMIN" || auth.role === "SUPER_ADMIN";

  // Students can only mark themselves present via face verification
  if (isStudent) {
    if (data.studentId && data.studentId !== auth.userId) {
      return NextResponse.json(
        { error: "Students can only mark their own attendance" },
        { status: 403 }
      );
    }
    if (data.status !== "PRESENT") {
      return NextResponse.json(
        { error: "Students can only mark themselves as PRESENT" },
        { status: 403 }
      );
    }
    if (!data.verifiedByFace) {
      return NextResponse.json(
        { error: "Face verification is required for student self-attendance" },
        { status: 403 }
      );
    }
  }

  if (!isAdmin && !isStudent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolvedStudentId = isStudent ? auth.userId : (data.studentId ?? auth.userId);
  const classId = data.classId;

  // Verify the student is enrolled (if enrollments exist for this class)
  if (isStudent) {
    const enrollmentCount = await prisma.classEnrollment.count({ where: { classId } });
    if (enrollmentCount > 0) {
      const enrolled = await prisma.classEnrollment.findUnique({
        where: { studentId_classId: { studentId: resolvedStudentId, classId } },
      });
      if (!enrolled) {
        return NextResponse.json(
          { error: "You are not enrolled in this class" },
          { status: 403 }
        );
      }
    }
  }

  // ── Time-window enforcement (students only; admins/teachers bypass) ───────
  // Use raw SQL so lateThresholdMins is always read correctly (new column).
  type ClassMetaRow = { id: string; subject: string; startTime: string; endTime: string; dayOfWeek: string; lateThresholdMins: number | bigint };
  const classMetaRows = await prisma.$queryRawUnsafe<ClassMetaRow[]>(
    `SELECT id, subject, startTime, endTime, dayOfWeek, COALESCE(lateThresholdMins, 10) as lateThresholdMins FROM classes WHERE id = ?`,
    classId
  );
  const rawMeta = classMetaRows[0] ?? null;
  // Coerce BigInt (Prisma raw) to plain number
  const classMeta = rawMeta ? { ...rawMeta, lateThresholdMins: Number(rawMeta.lateThresholdMins) } : null;
  if (!classMeta) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  // students must mark on the correct day and within the active window
  let resolvedStatus = data.status;

  if (isStudent) {
    const todayDay = JS_TO_DAYOFWEEK[new Date().getDay()];
    if (classMeta.dayOfWeek !== todayDay) {
      const dayName = classMeta.dayOfWeek.charAt(0) + classMeta.dayOfWeek.slice(1).toLowerCase();
      return NextResponse.json(
        { error: `This class runs on ${dayName}s — you can only mark attendance on that day.`, wrongDay: true },
        { status: 400 }
      );
    }

    const now           = new Date();
    const classStart    = parseClassTime(classMeta.startTime);
    const classEnd      = parseClassTime(classMeta.endTime);
    const lateThreshold = new Date(classStart.getTime() + classMeta.lateThresholdMins * 60_000);

    if (now < classStart) {
      return NextResponse.json(
        { error: `Class hasn't started yet — attendance opens at ${classMeta.startTime}.`, tooEarly: true, opensAt: classMeta.startTime },
        { status: 400 }
      );
    }
    if (now >= classEnd) {
      return NextResponse.json(
        { error: `Attendance window is closed — this class ended at ${classMeta.endTime}.`, tooLate: true, endedAt: classMeta.endTime },
        { status: 400 }
      );
    }
    // Automatically upgrade to LATE when past the class-specific grace period
    if (now > lateThreshold) {
      resolvedStatus = "LATE";
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Fetch existing record (explicit select avoids querying savedAt via ORM) ─
  const existing = await prisma.attendance.findUnique({
    where: { studentId_classId: { studentId: resolvedStudentId, classId } },
    select: {
      id: true,
      status: true,
      timestamp: true,
      remarks: true,
      latitude: true,
      longitude: true,
      locationName: true,
    },
  });

  // ── One-per-subject enforcement for students ──────────────────────────────
  if (isStudent && existing) {
    return NextResponse.json(
      {
        error: "Attendance already marked",
        alreadyMarked: true,
        message: `You have already marked attendance for this class (${existing.status} at ${new Date(existing.timestamp).toLocaleTimeString()}).`,
      },
      { status: 409 }
    );
  }

  // ── 24-hour edit window for teachers ─────────────────────────────────────
  if (isAdmin && existing && data.teacherSave) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE attendances ADD COLUMN savedAt DATETIME`).catch(() => {});
      type SavedRow = { savedAt: string | null };
      const rows = await prisma.$queryRawUnsafe<SavedRow[]>(
        `SELECT savedAt FROM attendances WHERE studentId = ? AND classId = ?`,
        resolvedStudentId, classId
      );
      const savedAtRaw = rows[0]?.savedAt ?? null;
      if (savedAtRaw) {
        const elapsed = Date.now() - new Date(savedAtRaw).getTime();
        if (elapsed > EDIT_WINDOW_MS) {
          return NextResponse.json(
            {
              error: "Edit window expired",
              locked: true,
              message: "This attendance record was saved more than 24 hours ago and can no longer be edited.",
              savedAt: savedAtRaw,
            },
            { status: 423 }
          );
        }
      }
    } catch {
      // skip lock check
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const now = new Date();
  const stampSavedAt = isAdmin && data.teacherSave;
  const remarks = data.remarks ?? (data.verifiedByFace ? "Self-marked via face recognition" : null);

  // Use raw SQL for the write — the Prisma ORM query engine binary is stale
  // and tries to include savedAt in every INSERT/UPDATE, crashing with P2022.
  if (existing) {
    const setParts: string[] = ["status = ?", "remarks = ?"];
    const setVals: unknown[] = [resolvedStatus, remarks];
    if (data.latitude  != null) { setParts.push("latitude = ?");     setVals.push(data.latitude); }
    if (data.longitude != null) { setParts.push("longitude = ?");    setVals.push(data.longitude); }
    if (data.locationName)      { setParts.push("locationName = ?"); setVals.push(data.locationName); }
    // savedAt stamped separately below after the main update
    setVals.push(resolvedStudentId, classId);
    await prisma.$executeRawUnsafe(
      `UPDATE attendances SET ${setParts.join(", ")} WHERE studentId = ? AND classId = ?`,
      ...setVals
    );
  } else {
    const { randomBytes } = await import("crypto");
    const newId = "c" + randomBytes(11).toString("base64url").slice(0, 24);
    const cols = ["id", "studentId", "classId", "status", "timestamp", "remarks"];
    const vals: unknown[] = [newId, resolvedStudentId, classId, resolvedStatus, now.toISOString(), remarks];
    if (data.latitude  != null) { cols.push("latitude");     vals.push(data.latitude); }
    if (data.longitude != null) { cols.push("longitude");    vals.push(data.longitude); }
    if (data.locationName)      { cols.push("locationName"); vals.push(data.locationName); }
    await prisma.$executeRawUnsafe(
      `INSERT INTO attendances (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      ...vals
    );
  }

  // Fetch the final record to return to the client
  type RawRow = {
    id: string; status: string; timestamp: string; remarks: string | null;
    latitude: number | null; longitude: number | null; locationName: string | null;
    studentId: string; classId: string;
  };
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `SELECT * FROM attendances WHERE studentId = ? AND classId = ?`,
    resolvedStudentId, classId
  );
  const row = rows[0];

  // Fetch student name for the response (class already fetched above as classMeta)
  const student = await prisma.user.findUnique({
    where: { id: resolvedStudentId },
    select: { id: true, name: true },
  });

  const record = {
    ...row,
    student: student ?? { id: resolvedStudentId, name: "Unknown" },
    class:   { id: classMeta.id, subject: classMeta.subject },
  };

  // Ensure savedAt column exists, then stamp it
  if (stampSavedAt) {
    try {
      // Add column if missing (idempotent — fails silently if already exists)
      await prisma.$executeRawUnsafe(`ALTER TABLE attendances ADD COLUMN savedAt DATETIME`).catch(() => {});
      await prisma.$executeRawUnsafe(
        `UPDATE attendances SET savedAt = ? WHERE studentId = ? AND classId = ?`,
        now.toISOString(), resolvedStudentId, classId
      );
    } catch {
      // lock feature inactive on this environment
    }
  }

  // Notify any open SSE streams watching this class
  notifyClassUpdated(classId);

  return NextResponse.json({ attendance: record });
}
