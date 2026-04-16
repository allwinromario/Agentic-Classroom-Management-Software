/**
 * Class enrollment API — teacher assigns specific students to a class.
 *
 * GET    /api/classes/[id]/enrollments          list enrolled students
 * POST   /api/classes/[id]/enrollments          enroll a student  { studentId }
 * DELETE /api/classes/[id]/enrollments          unenroll a student { studentId }
 * PUT    /api/classes/[id]/enrollments          replace full roster { studentIds: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function resolveClass(classId: string, auth: { role: string; userId: string }) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: { timetable: { select: { createdById: true } } },
  });
  if (!cls) return null;
  if (auth.role === "ADMIN" && cls.timetable.createdById !== auth.userId) return null;
  return cls;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth || !["ADMIN", "SUPER_ADMIN"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId: id },
    include: { student: { select: { id: true, name: true, email: true } } },
    orderBy: { student: { name: "asc" } },
  });

  return NextResponse.json({ enrollments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth || !["ADMIN", "SUPER_ADMIN"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const { studentId } = z.object({ studentId: z.string() }).parse(await req.json());
  const cls = await resolveClass(id, auth);
  if (!cls) return NextResponse.json({ error: "Class not found or access denied" }, { status: 404 });

  const enrollment = await prisma.classEnrollment.upsert({
    where: { studentId_classId: { studentId, classId: id } },
    create: { studentId, classId: id },
    update: {},
    include: { student: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ enrollment }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth || !["ADMIN", "SUPER_ADMIN"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const { studentId } = z.object({ studentId: z.string() }).parse(await req.json());
  const cls = await resolveClass(id, auth);
  if (!cls) return NextResponse.json({ error: "Class not found or access denied" }, { status: 404 });

  await prisma.classEnrollment.deleteMany({ where: { classId: id, studentId } });
  return NextResponse.json({ success: true });
}

/** Replace the entire enrollment roster for a class */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth || !["ADMIN", "SUPER_ADMIN"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const { studentIds } = z.object({ studentIds: z.array(z.string()) }).parse(await req.json());
  const cls = await resolveClass(id, auth);
  if (!cls) return NextResponse.json({ error: "Class not found or access denied" }, { status: 404 });

  // Atomic replace: delete old, insert new
  await prisma.classEnrollment.deleteMany({ where: { classId: id } });
  if (studentIds.length > 0) {
    await prisma.classEnrollment.createMany({
      data: studentIds.map((sid) => ({ studentId: sid, classId: id })),
    });
  }

  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId: id },
    include: { student: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ enrollments });
}
