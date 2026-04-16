import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = auth.role === "STUDENT"
    ? auth.userId
    : searchParams.get("studentId") ?? undefined;

  const marks = await prisma.marks.findMany({
    where: { ...(studentId ? { studentId } : {}) },
    include: { student: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ marks });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    studentId: string;
    entries: Array<{ subject: string; score: number; maxScore: number; examType: string }>;
  };

  if (!body.studentId || !Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "studentId and entries required" }, { status: 400 });
  }

  const created = await prisma.marks.createMany({
    data: body.entries.map((e) => ({
      studentId: body.studentId,
      subject: e.subject,
      score: e.score,
      maxScore: e.maxScore,
      examType: e.examType ?? "MIDTERM",
    })),
  });

  return NextResponse.json({ created: created.count }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.marks.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
