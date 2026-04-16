import type { StudentDashboard } from "@/lib/types/domain";

/** Sample data when MongoDB is not configured (local preview only). */
export function getDemoDashboard(studentId: string): StudentDashboard {
  return {
    student: {
      studentId,
      name: "Demo Student",
      classId: "MATH101",
    },
    attendanceRate: 0.87,
    recentAttendance: [
      { studentId, classId: "MATH101", date: "2026-04-10", status: "present" },
      { studentId, classId: "MATH101", date: "2026-04-08", status: "absent" },
    ],
    marksBySubject: {
      Mathematics: { average: 82, trend: "up" },
      Physics: { average: 74, trend: "flat" },
    },
  };
}
