import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studentId =
    auth.role === "STUDENT"
      ? auth.userId
      : new URL(req.url).searchParams.get("studentId") ?? undefined;

  const reports = await prisma.report.findMany({
    where: { ...(studentId ? { studentId } : {}) },
    include: { student: { select: { id: true, name: true, email: true } } },
    orderBy: { generatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    reports: reports.map((r) => ({
      ...r,
      subjectBreakdown: safeParseJSON(r.subjectBreakdown, []),
      recommendations: safeParseJSON(r.recommendations, []),
      studyPlan: safeParseJSON(r.studyPlan, []),
    })),
  });
}

function safeParseJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T; } catch { return fallback; }
}
