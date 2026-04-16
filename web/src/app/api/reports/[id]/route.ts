import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: { student: { select: { id: true, name: true, email: true } } },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (auth.role === "STUDENT" && report.studentId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    report: {
      ...report,
      subjectBreakdown: safeParseJSON(report.subjectBreakdown, []),
      recommendations: safeParseJSON(report.recommendations, []),
      studyPlan: safeParseJSON(report.studyPlan, []),
    },
  });
}

function safeParseJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T; } catch { return fallback; }
}
