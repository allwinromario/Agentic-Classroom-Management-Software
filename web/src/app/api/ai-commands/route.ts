import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseNLCommand, analyzeStudent } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { command } = (await req.json()) as { command: string };
  if (!command?.trim()) return NextResponse.json({ error: "command required" }, { status: 400 });

  const parsed = parseNLCommand(command);

  switch (parsed.intent) {
    case "top_students": {
      const limit = Number(parsed.params.limit ?? 5);
      const students = await prisma.user.findMany({
        where: { role: "STUDENT", status: "APPROVED" },
        include: { marks: true, attendances: true },
      });

      const ranked = students
        .map((s) => {
          const total = s.marks.reduce((acc, m) => acc + (m.maxScore > 0 ? m.score / m.maxScore : 0), 0);
          const avg = s.marks.length > 0 ? Math.round((total / s.marks.length) * 100) : 0;
          return { id: s.id, name: s.name, email: s.email, averageMarks: avg, marksCount: s.marks.length };
        })
        .filter((s) => s.marksCount > 0)
        .sort((a, b) => b.averageMarks - a.averageMarks)
        .slice(0, limit);

      return NextResponse.json({
        intent: parsed.intent,
        command,
        result: ranked,
        message: `Top ${limit} students by average marks`,
      });
    }

    case "low_attendance": {
      const threshold = Number(parsed.params.threshold ?? 75);
      const students = await prisma.user.findMany({
        where: { role: "STUDENT", status: "APPROVED" },
        include: { attendances: true },
      });

      const lowAtt = students
        .map((s) => {
          const total = s.attendances.length;
          const present = s.attendances.filter((a) => a.status === "PRESENT").length;
          const pct = total > 0 ? Math.round((present / total) * 100) : 0;
          return { id: s.id, name: s.name, email: s.email, attendancePercentage: pct, totalClasses: total };
        })
        .filter((s) => s.attendancePercentage < threshold && s.totalClasses > 0)
        .sort((a, b) => a.attendancePercentage - b.attendancePercentage);

      return NextResponse.json({
        intent: parsed.intent,
        command,
        result: lowAtt,
        message: `Students with attendance below ${threshold}%`,
      });
    }

    case "failing_students": {
      const threshold = Number(parsed.params.threshold ?? 40);
      const students = await prisma.user.findMany({
        where: { role: "STUDENT", status: "APPROVED" },
        include: { marks: true },
      });

      const failing = students
        .map((s) => {
          const total = s.marks.reduce((acc, m) => acc + (m.maxScore > 0 ? m.score / m.maxScore : 0), 0);
          const avg = s.marks.length > 0 ? Math.round((total / s.marks.length) * 100) : 0;
          const weakSubjects = getWeakSubjects(s.marks, threshold);
          return { id: s.id, name: s.name, email: s.email, averageMarks: avg, weakSubjects };
        })
        .filter((s) => s.averageMarks < threshold && s.weakSubjects.length > 0)
        .sort((a, b) => a.averageMarks - b.averageMarks);

      return NextResponse.json({
        intent: parsed.intent,
        command,
        result: failing,
        message: `Students with average marks below ${threshold}%`,
      });
    }

    case "generate_report": {
      const students = await prisma.user.findMany({
        where: { role: "STUDENT", status: "APPROVED" },
        include: { marks: true, attendances: true },
      });

      const reports = students
        .filter((s) => s.marks.length > 0)
        .map((s) => {
          const totalAtt = s.attendances.length;
          const presentAtt = s.attendances.filter((a) => a.status === "PRESENT").length;
          const attendancePercentage = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
          const analysis = analyzeStudent({
            id: s.id,
            name: s.name,
            email: s.email,
            attendancePercentage,
            marks: s.marks.map((m) => ({ subject: m.subject, score: m.score, maxScore: m.maxScore, examType: m.examType })),
          });
          return {
            id: s.id,
            name: s.name,
            email: s.email,
            attendancePercentage,
            averageMarks: analysis.averageMarks,
            performanceLevel: analysis.performanceLevel,
            summary: analysis.summary,
          };
        });

      return NextResponse.json({
        intent: parsed.intent,
        command,
        result: reports,
        message: `Generated performance overview for ${reports.length} students`,
      });
    }

    case "class_performance": {
      const students = await prisma.user.findMany({
        where: { role: "STUDENT", status: "APPROVED" },
        include: { marks: true, attendances: true },
      });

      const summary = {
        totalStudents: students.length,
        withMarks: students.filter((s) => s.marks.length > 0).length,
        averageAttendance: 0,
        averageMarks: 0,
        distribution: { GOOD: 0, AVERAGE: 0, WEAK: 0 },
      };

      let attSum = 0, marksSum = 0, marksCount = 0;
      for (const s of students) {
        const total = s.attendances.length;
        const present = s.attendances.filter((a) => a.status === "PRESENT").length;
        attSum += total > 0 ? (present / total) * 100 : 0;

        if (s.marks.length > 0) {
          const mTotal = s.marks.reduce((acc, m) => acc + (m.maxScore > 0 ? (m.score / m.maxScore) * 100 : 0), 0);
          const mAvg = mTotal / s.marks.length;
          marksSum += mAvg;
          marksCount++;
          if (mAvg >= 70) summary.distribution.GOOD++;
          else if (mAvg >= 40) summary.distribution.AVERAGE++;
          else summary.distribution.WEAK++;
        }
      }

      summary.averageAttendance = Math.round(attSum / Math.max(students.length, 1));
      summary.averageMarks = Math.round(marksSum / Math.max(marksCount, 1));

      return NextResponse.json({
        intent: parsed.intent,
        command,
        result: summary,
        message: "Class performance overview",
      });
    }

    default:
      return NextResponse.json({
        intent: "unknown",
        command,
        result: null,
        message: `Command not recognized. Try: "Generate report for all students", "Show top 5 students", "Who has low attendance?", "Show failing students"`,
      });
  }
}

function getWeakSubjects(marks: Array<{ subject: string; score: number; maxScore: number }>, threshold: number): string[] {
  const map = new Map<string, { score: number; max: number }>();
  for (const m of marks) {
    const e = map.get(m.subject) ?? { score: 0, max: 0 };
    map.set(m.subject, { score: e.score + m.score, max: e.max + m.maxScore });
  }
  return Array.from(map.entries())
    .filter(([, d]) => d.max > 0 && (d.score / d.max) * 100 < threshold)
    .map(([subject]) => subject);
}
