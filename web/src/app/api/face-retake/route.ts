/**
 * Face retake request / approval API
 *
 * POST /api/face-retake          – student submits a retake request with a reason
 * PATCH /api/face-retake         – teacher/admin approves a student's retake request
 * DELETE /api/face-retake        – teacher/admin dismisses (rejects) the request
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  reason: z.string().min(10, "Please provide a reason (min 10 characters)").max(500),
});

const approveSchema = z.object({
  studentId: z.string(),
  approve: z.boolean(),
});

/** Student requests a face retake (only if already registered) */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "STUDENT") {
    return NextResponse.json({ error: "Only students can request a retake" }, { status: 403 });
  }

  const body = await req.json();
  const { reason } = requestSchema.parse(body);

  const student = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!student.faceRegistered) {
    return NextResponse.json(
      { error: "You do not have a registered face yet. Please register your face first." },
      { status: 400 }
    );
  }

  if (student.faceRetakeRequested) {
    return NextResponse.json(
      { error: "You already have a pending retake request. Wait for teacher approval." },
      { status: 409 }
    );
  }

  if (student.faceRetakeApproved) {
    return NextResponse.json(
      { error: "A retake is already approved. Please upload your new photo now." },
      { status: 409 }
    );
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      faceRetakeRequested: true,
      faceRetakeReason: reason,
    },
  });

  // Create a system alert so teachers/admins see it immediately
  await prisma.alert.create({
    data: {
      title: "Face Retake Request",
      message: `Student **${student.name}** has requested a face photo retake.\nReason: "${reason}"`,
      severity: "warning",
      active: true,
      createdById: auth.userId,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Retake request submitted. Your teacher has been notified.",
  });
}

/** Teacher/admin approves or rejects a retake request */
export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || !["ADMIN", "SUPER_ADMIN"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { studentId, approve } = approveSchema.parse(body);

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (!student.faceRetakeRequested) {
    return NextResponse.json({ error: "No pending retake request for this student" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: studentId },
    data: {
      faceRetakeRequested: false,
      faceRetakeApproved: approve,
      // If rejected, clear the reason
      faceRetakeReason: approve ? student.faceRetakeReason : null,
    },
  });

  // Dismiss all face retake alerts for this student
  await prisma.alert.updateMany({
    where: {
      createdById: studentId,
      title: "Face Retake Request",
      active: true,
    },
    data: { active: false },
  });

  return NextResponse.json({
    success: true,
    message: approve
      ? "Retake approved. The student can now re-register their face."
      : "Retake request rejected.",
  });
}

/** GET — list all pending retake requests (ADMIN / SUPER_ADMIN) */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || !["ADMIN", "SUPER_ADMIN"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.user.findMany({
    where: { role: "STUDENT", faceRetakeRequested: true },
    select: {
      id: true,
      name: true,
      email: true,
      faceRetakeReason: true,
      faceRetakeRequested: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  return NextResponse.json({ requests });
}
