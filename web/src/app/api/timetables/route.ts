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
});

const createSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  classes: z.array(classSchema).optional().default([]),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const timetable = await prisma.timetable.create({
    data: {
      title: data.title,
      description: data.description,
      createdById: auth.userId,
      classes: {
        create: data.classes,
      },
    },
    include: {
      classes: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ timetable }, { status: 201 });
}
