/** Shared domain types for SCMS web + future API layer */

export type ClassId =
  | "MATH101"
  | "PHY102"
  | "CHEM203"
  | "BIO102"
  | "ENG101";

export interface Student {
  studentId: string;
  name: string;
  classId: ClassId;
}

export interface AttendanceRecord {
  studentId: string;
  classId: ClassId;
  date: string;
  status: "present" | "absent" | "late";
  remarks?: string;
}

export interface MarkEntry {
  studentId: string;
  subject: string;
  score: number;
  maxScore: number;
  term: string;
}

export interface StudentDashboard {
  student: Student;
  attendanceRate: number;
  recentAttendance: AttendanceRecord[];
  marksBySubject: Record<string, { average: number; trend: "up" | "down" | "flat" }>;
}

export interface StudyRecommendation {
  id: string;
  kind: "weak_subject" | "study_plan" | "extra_class";
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
}
