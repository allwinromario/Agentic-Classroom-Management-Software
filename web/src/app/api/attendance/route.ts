import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId   = searchParams.get("classId");
  const studentId = searchParams.get("studentId") ?? (auth.role === "STUDENT" ? auth.userId : undefined);

  const isAdmin = auth.role === "ADMIN" || auth.role === "SUPER_ADMIN";

  // Build WHERE clause
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (auth.role === "STUDENT") {
    conditions.push(`a.studentId = ?`);
    params.push(auth.userId);
  } else if (studentId) {
    conditions.push(`a.studentId = ?`);
    params.push(studentId);
  }

  if (classId) {
    conditions.push(`a.classId = ?`);
    params.push(classId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit  = isAdmin ? "" : "LIMIT 500";

  // Use raw SQL to include savedAt without triggering the stale Prisma engine
  type RawAttRow = {
    id: string;
    status: string;
    timestamp: string;
    savedAt: string | null;
    remarks: string | null;
    latitude: number | null;
    longitude: number | null;
    locationName: string | null;
    studentId: string;
    studentName: string;
    studentEmail: string;
    classId: string;
    classSubject: string;
    classDayOfWeek: string;
    classStartTime: string;
  };

  const rows = await prisma.$queryRawUnsafe<RawAttRow[]>(
    `SELECT
       a.id, a.status, a.timestamp, a.savedAt, a.remarks,
       a.latitude, a.longitude, a.locationName,
       a.studentId,
       u.name  AS studentName,
       u.email AS studentEmail,
       a.classId,
       c.subject      AS classSubject,
       c.dayOfWeek    AS classDayOfWeek,
       c.startTime    AS classStartTime
     FROM attendances a
     LEFT JOIN users  u ON u.id = a.studentId
     LEFT JOIN classes c ON c.id = a.classId
     ${where}
     ORDER BY a.timestamp DESC
     ${limit}`,
    ...params
  );

  const attendance = rows.map((r) => ({
    id:          r.id,
    status:      r.status,
    timestamp:   r.timestamp,
    savedAt:     r.savedAt ?? null,
    remarks:     r.remarks ?? null,
    latitude:    r.latitude  ?? null,
    longitude:   r.longitude ?? null,
    locationName: r.locationName ?? null,
    student: { id: r.studentId, name: r.studentName ?? "Unknown", email: r.studentEmail ?? "" },
    class: {
      id:        r.classId,
      subject:   r.classSubject   ?? "Unknown",
      dayOfWeek: r.classDayOfWeek ?? "",
      startTime: r.classStartTime ?? "",
    },
  }));

  return NextResponse.json({ attendance });
}
