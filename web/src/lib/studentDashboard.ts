import type { AttendanceRecord, ClassId, Student, StudentDashboard } from "@/lib/types/domain";
import { getDb, isMongoConfigured } from "@/lib/mongo";

type MongoStudent = {
  name: string;
  student_id: string;
  class_id: string;
  guardiancontact?: string;
};

type MongoAttendance = {
  student_id: string;
  class_id: string;
  date: Date | string;
  status: string;
  remarks?: string | null;
};

type MongoAssessment = {
  student_id: string;
  classId: string;
  assessmentType: string;
  maxMarks: number;
  marksObtained: number;
  remarks?: string | null;
};

export type DashboardLoadResult =
  | { ok: true; data: StudentDashboard }
  | { ok: false; reason: "no_database" | "not_found" | "error"; message?: string };

export async function loadStudentDashboard(studentId: string): Promise<DashboardLoadResult> {
  if (!isMongoConfigured()) {
    return { ok: false, reason: "no_database" };
  }

  try {
    const db = await getDb();
    const rawStudent = await db.collection<MongoStudent>("students").findOne({ student_id: studentId });
    if (!rawStudent) {
      return { ok: false, reason: "not_found" };
    }

    const student: Student = {
      studentId: rawStudent.student_id,
      name: rawStudent.name,
      classId: rawStudent.class_id as ClassId,
    };

    const attendanceDocs = await db
      .collection<MongoAttendance>("attendance")
      .find({ student_id: studentId })
      .sort({ date: -1 })
      .limit(30)
      .toArray();

    const total = attendanceDocs.length;
    const present = attendanceDocs.filter((a) => a.status === "present").length;
    const attendanceRate = total === 0 ? 0 : present / total;

    const recentAttendance: AttendanceRecord[] = attendanceDocs.map((a) => {
      const d = a.date instanceof Date ? a.date.toISOString().slice(0, 10) : String(a.date).slice(0, 10);
      return {
        studentId: a.student_id,
        classId: a.class_id as ClassId,
        date: d,
        status: a.status === "absent" ? "absent" : "present",
        remarks: a.remarks ?? undefined,
      };
    });

    const assessmentDocs = await db
      .collection<MongoAssessment>("assessments")
      .find({ student_id: studentId })
      .toArray();

    const bySubject: Record<string, { scores: number[]; maxes: number[] }> = {};
    for (const a of assessmentDocs) {
      const subject = a.classId || "General";
      if (!bySubject[subject]) bySubject[subject] = { scores: [], maxes: [] };
      bySubject[subject].scores.push(a.marksObtained);
      bySubject[subject].maxes.push(a.maxMarks);
    }

    const marksBySubject: StudentDashboard["marksBySubject"] = {};
    for (const [subject, { scores, maxes }] of Object.entries(bySubject)) {
      const pct = scores.map((s, i) => (maxes[i] ? (s / maxes[i]) * 100 : 0));
      const average = Math.round(pct.reduce((a, b) => a + b, 0) / (pct.length || 1));
      const firstHalf = pct.slice(0, Math.ceil(pct.length / 2));
      const secondHalf = pct.slice(Math.ceil(pct.length / 2));
      const m1 = firstHalf.length ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : average;
      const m2 = secondHalf.length ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : average;
      let trend: "up" | "down" | "flat" = "flat";
      if (m2 > m1 + 3) trend = "up";
      else if (m2 < m1 - 3) trend = "down";
      marksBySubject[subject] = { average, trend };
    }

    const data: StudentDashboard = {
      student,
      attendanceRate,
      recentAttendance,
      marksBySubject,
    };

    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, reason: "error", message };
  }
}
