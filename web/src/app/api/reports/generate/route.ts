import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeStudent, generateReportSummaryAI } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { studentId: string };
  if (!body.studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  // Fetch student and their data
  const student = await prisma.user.findUnique({
    where: { id: body.studentId },
    select: { id: true, name: true, email: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const [marks, attendanceRecords] = await Promise.all([
    prisma.marks.findMany({ where: { studentId: body.studentId } }),
    prisma.attendance.findMany({ where: { studentId: body.studentId } }),
  ]);

  const totalAtt = attendanceRecords.length;
  const presentAtt = attendanceRecords.filter((a) => a.status === "PRESENT").length;
  const attendancePercentage = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

  const reportData = analyzeStudent({
    id: student.id,
    name: student.name,
    email: student.email,
    attendancePercentage,
    marks: marks.map((m) => ({
      subject: m.subject,
      score: m.score,
      maxScore: m.maxScore,
      examType: m.examType,
    })),
  });

  // Optionally upgrade summary via OpenAI
  const summary = await generateReportSummaryAI(reportData);

  // Upsert report (one latest report per student)
  const existing = await prisma.report.findFirst({
    where: { studentId: body.studentId },
    orderBy: { generatedAt: "desc" },
  });

  const reportRecord = existing
    ? await prisma.report.update({
        where: { id: existing.id },
        data: {
          attendancePercentage: reportData.attendancePercentage,
          averageMarks: reportData.averageMarks,
          performanceLevel: reportData.performanceLevel,
          subjectBreakdown: JSON.stringify(reportData.subjectBreakdown),
          recommendations: JSON.stringify(reportData.recommendations),
          studyPlan: JSON.stringify(reportData.studyPlan),
          summary,
          generatedAt: new Date(),
        },
      })
    : await prisma.report.create({
        data: {
          studentId: body.studentId,
          attendancePercentage: reportData.attendancePercentage,
          averageMarks: reportData.averageMarks,
          performanceLevel: reportData.performanceLevel,
          subjectBreakdown: JSON.stringify(reportData.subjectBreakdown),
          recommendations: JSON.stringify(reportData.recommendations),
          studyPlan: JSON.stringify(reportData.studyPlan),
          summary,
        },
      });

  return NextResponse.json({
    report: {
      ...reportRecord,
      subjectBreakdown: reportData.subjectBreakdown,
      recommendations: reportData.recommendations,
      studyPlan: reportData.studyPlan,
      studentName: student.name,
      studentEmail: student.email,
    },
  });
}
