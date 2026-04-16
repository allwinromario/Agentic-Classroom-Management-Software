import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STUDENT"]).optional(),
  name: z.string().min(2).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const data = updateSchema.parse(body);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Prevent super admin from deleting themselves
  if (user.id === auth.userId) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  // Archive first, then cascade-delete all related records manually,
  // then hard-delete the user (frees the email for re-registration).
  await prisma.$transaction(async (tx) => {
    // 1. Archive
    await tx.deletedUser.create({
      data: {
        originalId:  user.id,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        status:      user.status,
        deletedById: auth.userId,
      },
    });

    // 2. Delete all child records that reference this user
    await tx.classEnrollment.deleteMany({ where: { studentId: id } });
    await tx.attendance.deleteMany({ where: { studentId: id } });
    await tx.chatMessage.deleteMany({ where: { userId: id } });
    await tx.alert.deleteMany({ where: { createdById: id } });
    // For admins who created timetables: cascade-delete their timetables & classes
    const timetables = await tx.timetable.findMany({
      where: { createdById: id },
      select: { id: true },
    });
    const timetableIds = timetables.map((t) => t.id);
    if (timetableIds.length > 0) {
      await tx.classEnrollment.deleteMany({ where: { class: { timetableId: { in: timetableIds } } } });
      await tx.attendance.deleteMany({ where: { class: { timetableId: { in: timetableIds } } } });
      await tx.class.deleteMany({ where: { timetableId: { in: timetableIds } } });
      await tx.timetable.deleteMany({ where: { id: { in: timetableIds } } });
    }

    // 3. Delete the user
    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ success: true, message: "User deleted and email freed for re-registration." });
}
