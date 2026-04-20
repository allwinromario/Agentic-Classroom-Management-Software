/**
 * AI Service — rule-based intelligence with Gemini-ready fallback.
 * All business logic lives here so API routes stay thin.
 */
import { GoogleGenAI } from "@google/genai";

export interface MarkInput {
  subject: string;
  score: number;
  maxScore: number;
  examType: string;
}

export interface StudentData {
  id: string;
  name: string;
  email: string;
  attendancePercentage: number;
  marks: MarkInput[];
}

export type PerformanceLevel = "STRONG" | "AVERAGE" | "WEAK";
export type ReportLevel = "GOOD" | "AVERAGE" | "WEAK";

export interface SubjectAnalysis {
  subject: string;
  score: number;
  maxScore: number;
  percentage: number;
  level: PerformanceLevel;
  examType: string;
}

export interface Recommendation {
  type: "study" | "attendance" | "exam" | "general";
  priority: "high" | "medium" | "low";
  message: string;
  subject?: string;
}

export interface StudyPlanDay {
  day: string;
  subjects: string[];
  hoursAllocated: number;
  focus: string;
}

export interface ReportData {
  studentId: string;
  studentName: string;
  attendancePercentage: number;
  averageMarks: number;
  performanceLevel: ReportLevel;
  subjectBreakdown: SubjectAnalysis[];
  recommendations: Recommendation[];
  studyPlan: StudyPlanDay[];
  summary: string;
}

// ─── Core Analysis ───────────────────────────────────────────────────────────

export function analyzeStudent(data: StudentData): ReportData {
  const subjectBreakdown = aggregateBySubject(data.marks);
  const averageMarks =
    subjectBreakdown.length > 0
      ? Math.round(subjectBreakdown.reduce((s, x) => s + x.percentage, 0) / subjectBreakdown.length)
      : 0;

  const performanceLevel: ReportLevel =
    averageMarks >= 70 ? "GOOD" : averageMarks >= 40 ? "AVERAGE" : "WEAK";

  const recommendations = buildRecommendations(data.attendancePercentage, subjectBreakdown);
  const studyPlan = buildStudyPlan(subjectBreakdown);
  const summary = buildSummary({ attendancePercentage: data.attendancePercentage, averageMarks, performanceLevel, subjectBreakdown });

  return {
    studentId: data.id,
    studentName: data.name,
    attendancePercentage: data.attendancePercentage,
    averageMarks,
    performanceLevel,
    subjectBreakdown,
    recommendations,
    studyPlan,
    summary,
  };
}

function aggregateBySubject(marks: MarkInput[]): SubjectAnalysis[] {
  const map = new Map<string, { score: number; max: number; examType: string }>();
  for (const m of marks) {
    const existing = map.get(m.subject) ?? { score: 0, max: 0, examType: m.examType };
    map.set(m.subject, {
      score: existing.score + m.score,
      max: existing.max + m.maxScore,
      examType: m.examType,
    });
  }
  return Array.from(map.entries()).map(([subject, d]) => {
    const percentage = d.max > 0 ? Math.round((d.score / d.max) * 100) : 0;
    return {
      subject,
      score: d.score,
      maxScore: d.max,
      percentage,
      level: percentage >= 70 ? "STRONG" : percentage >= 40 ? "AVERAGE" : "WEAK",
      examType: d.examType,
    };
  });
}

function buildRecommendations(
  attendancePct: number,
  subjects: SubjectAnalysis[]
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (attendancePct < 75) {
    recs.push({
      type: "attendance",
      priority: "high",
      message: `Attendance is ${attendancePct.toFixed(1)}% — below the 75% threshold required for exams. Attend every class until eligibility is restored.`,
    });
  } else if (attendancePct < 85) {
    recs.push({
      type: "attendance",
      priority: "medium",
      message: `Attendance stands at ${attendancePct.toFixed(1)}%. Aim for at least 85% to give yourself a safety margin.`,
    });
  }

  for (const s of subjects.filter((x) => x.level === "WEAK")) {
    recs.push({
      type: "study",
      priority: "high",
      subject: s.subject,
      message: `Critical: ${s.subject} score is ${s.percentage}%. Revise core chapters, attempt previous papers, and ask for extra help immediately.`,
    });
  }

  for (const s of subjects.filter((x) => x.level === "AVERAGE")) {
    recs.push({
      type: "study",
      priority: "medium",
      subject: s.subject,
      message: `${s.subject} (${s.percentage}%) can be pushed higher. Dedicate focused practice sessions and review solved examples.`,
    });
  }

  const weakCount = subjects.filter((x) => x.level === "WEAK").length;
  if (weakCount > 1) {
    recs.push({
      type: "exam",
      priority: "high",
      message: "Multiple weak subjects detected. Consider forming a study group and scheduling regular revision before the next exam.",
    });
  }

  if (recs.length === 0) {
    recs.push({
      type: "general",
      priority: "low",
      message: "Outstanding performance! Keep your routine consistent and challenge yourself with advanced problems to stay ahead.",
    });
  }

  return recs;
}

function buildStudyPlan(subjects: SubjectAnalysis[]): StudyPlanDay[] {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const sorted = [...subjects].sort((a, b) => {
    const p: Record<PerformanceLevel, number> = { WEAK: 0, AVERAGE: 1, STRONG: 2 };
    return p[a.level] - p[b.level];
  });

  const hoursMap: Record<PerformanceLevel, number> = { WEAK: 3, AVERAGE: 2, STRONG: 1.5 };

  return days.map((day, i) => {
    if (day === "Sunday") {
      return {
        day,
        subjects: ["Revision & Rest"],
        hoursAllocated: 2,
        focus: "Review the week, revise notes, and rest — consistency matters more than marathon sessions.",
      };
    }

    if (sorted.length === 0) {
      return { day, subjects: [], hoursAllocated: 0, focus: "No subjects to plan yet." };
    }

    const primary = sorted[i % sorted.length];
    const secondary = sorted.length > 1 ? sorted[(i + 1) % sorted.length] : null;
    const subjectList = secondary && secondary.subject !== primary.subject
      ? [primary.subject, secondary.subject]
      : [primary.subject];

    const hours = hoursMap[primary.level] + (secondary ? 1 : 0);

    const focusMsg =
      primary.level === "WEAK"
        ? `Deep-dive ${primary.subject} — master fundamentals before moving to practice problems`
        : primary.level === "AVERAGE"
        ? `Consolidate ${primary.subject} with timed problem sets`
        : `Maintain ${primary.subject} with light revision and advanced challenges`;

    return {
      day,
      subjects: subjectList,
      hoursAllocated: Math.round(hours * 10) / 10,
      focus: focusMsg,
    };
  });
}

function buildSummary(d: {
  attendancePercentage: number;
  averageMarks: number;
  performanceLevel: ReportLevel;
  subjectBreakdown: SubjectAnalysis[];
}): string {
  const weak = d.subjectBreakdown.filter((s) => s.level === "WEAK").map((s) => s.subject);
  const strong = d.subjectBreakdown.filter((s) => s.level === "STRONG").map((s) => s.subject);

  if (d.performanceLevel === "GOOD") {
    const base = `Excellent performance — average score of ${d.averageMarks}% with ${d.attendancePercentage.toFixed(1)}% attendance.`;
    const strengths = strong.length ? ` Excelling in ${strong.join(", ")}.` : "";
    return base + strengths + " Keep up the outstanding momentum!";
  }

  if (d.performanceLevel === "AVERAGE") {
    const base = `Satisfactory performance — average of ${d.averageMarks}% and ${d.attendancePercentage.toFixed(1)}% attendance.`;
    const needs = weak.length ? ` Needs improvement in ${weak.join(", ")}.` : "";
    return base + needs + " Consistent effort will drive meaningful growth.";
  }

  const base = `Performance requires urgent attention — average of ${d.averageMarks}% with ${d.attendancePercentage.toFixed(1)}% attendance.`;
  const needs = weak.length ? ` Critical gaps in ${weak.join(", ")}.` : "";
  return base + needs + " Please seek additional support and increase study intensity immediately.";
}

// ─── Marks Validation ────────────────────────────────────────────────────────

export interface ValidationIssue {
  row: number;
  field: string;
  issue: string;
  suggestion: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  corrected: MarkInput[];
}

export function validateMarks(
  rows: Array<Partial<MarkInput> & { row?: number }>
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const corrected: MarkInput[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = row.row ?? i + 1;
    let { subject, score, maxScore, examType } = row;
    let rowOk = true;

    if (!subject || String(subject).trim() === "") {
      issues.push({ row: rowNum, field: "subject", issue: "Subject is missing", suggestion: "Enter the subject name (e.g. Mathematics)" });
      rowOk = false;
    } else {
      subject = String(subject).trim();
    }

    const s = Number(score);
    const m = Number(maxScore);

    if (isNaN(s)) {
      issues.push({ row: rowNum, field: "score", issue: `Score "${score}" is not a number`, suggestion: "Enter a numeric value (e.g. 72)" });
      rowOk = false;
    } else if (s < 0) {
      issues.push({ row: rowNum, field: "score", issue: "Score cannot be negative", suggestion: "Use 0 as the minimum" });
      score = 0;
    }

    if (isNaN(m) || m <= 0) {
      issues.push({ row: rowNum, field: "maxScore", issue: `Max score "${maxScore}" must be a positive number`, suggestion: "Common values: 100, 50, 25" });
      rowOk = false;
    }

    if (!isNaN(s) && !isNaN(m) && m > 0 && s > m) {
      issues.push({ row: rowNum, field: "score", issue: `Score (${s}) exceeds max score (${m})`, suggestion: `Set score to maximum ${m} or review the entry` });
      score = m;
    }

    if (!isNaN(s) && !isNaN(m) && m > 0) {
      const pct = (s / m) * 100;
      if (pct < 5 && s > 0) {
        issues.push({ row: rowNum, field: "score", issue: `Score of ${s}/${m} (${pct.toFixed(1)}%) is unusually low`, suggestion: "Verify this is correct — it may be a data entry error" });
      }
    }

    const validExamTypes = ["MIDTERM", "FINAL", "QUIZ", "ASSIGNMENT", "PRACTICAL"];
    if (!examType || !validExamTypes.includes(String(examType).toUpperCase())) {
      issues.push({ row: rowNum, field: "examType", issue: `Invalid exam type "${examType}"`, suggestion: `Use one of: ${validExamTypes.join(", ")}` });
      examType = "MIDTERM";
    } else {
      examType = String(examType).toUpperCase();
    }

    if (rowOk || (!isNaN(s) && !isNaN(m) && m > 0 && subject)) {
      corrected.push({
        subject: String(subject ?? "").trim(),
        score: Math.max(0, Math.min(Number(score), Number(maxScore))),
        maxScore: Number(maxScore),
        examType: String(examType).toUpperCase(),
      });
    }
  }

  return { valid: issues.length === 0, issues, corrected };
}

// ─── Natural Language Command Parser ─────────────────────────────────────────

export type CommandIntent =
  | "generate_report"
  | "top_students"
  | "low_attendance"
  | "failing_students"
  | "class_performance"
  | "unknown";

export interface ParsedCommand {
  intent: CommandIntent;
  params: Record<string, string | number>;
  confidence: number;
}

export function parseNLCommand(input: string): ParsedCommand {
  const text = input.toLowerCase().trim();

  if (/generate.*(report|summary)|report.*for/i.test(text)) {
    const classMatch = text.match(/class\s+([a-z0-9 ]+)/i);
    const studentMatch = text.match(/student[:\s]+([a-z ]+)/i);
    return {
      intent: "generate_report",
      params: {
        ...(classMatch ? { className: classMatch[1].trim() } : {}),
        ...(studentMatch ? { studentName: studentMatch[1].trim() } : {}),
      },
      confidence: 0.95,
    };
  }

  if (/top\s+(\d+)\s+students?|best.+students?/i.test(text)) {
    const n = text.match(/top\s+(\d+)/i)?.[1];
    return { intent: "top_students", params: { limit: Number(n ?? 5) }, confidence: 0.9 };
  }

  if (/low.*(attendance|present)|attendance.*low|below.*75|absent/i.test(text)) {
    const threshold = text.match(/(\d+)\s*%/)?.[1];
    return { intent: "low_attendance", params: { threshold: Number(threshold ?? 75) }, confidence: 0.9 };
  }

  if (/fail|weak.*student|student.*fail|below.*(40|pass)/i.test(text)) {
    return { intent: "failing_students", params: { threshold: 40 }, confidence: 0.85 };
  }

  if (/class.*(performance|summary|results?)/i.test(text)) {
    const classMatch = text.match(/class\s+([a-z0-9 ]+)/i);
    return {
      intent: "class_performance",
      params: { className: classMatch?.[1]?.trim() ?? "" },
      confidence: 0.8,
    };
  }

  return { intent: "unknown", params: {}, confidence: 0 };
}

// ─── Gemini-ready upgrade path ────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function readGeminiText(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;

  const withText = response as { text?: string };
  if (typeof withText.text === "string" && withText.text.trim()) {
    return withText.text.trim();
  }

  const candidates = (response as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  }).candidates;
  const text = candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  return text ? text : null;
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function isRecommendation(item: unknown): item is Recommendation {
  if (!item || typeof item !== "object") return false;
  const rec = item as Partial<Recommendation>;
  const validType = rec.type === "study" || rec.type === "attendance" || rec.type === "exam" || rec.type === "general";
  const validPriority = rec.priority === "high" || rec.priority === "medium" || rec.priority === "low";
  const validMessage = typeof rec.message === "string" && rec.message.trim().length > 0;
  const validSubject = rec.subject === undefined || typeof rec.subject === "string";
  return validType && validPriority && validMessage && validSubject;
}

export async function generateReportSummaryAI(data: ReportData): Promise<string> {
  const client = getGeminiClient();
  if (!client) return data.summary;

  try {
    const prompt = `Write a concise 2-3 sentence academic progress summary.
Student name: ${data.studentName}
- Attendance: ${data.attendancePercentage.toFixed(1)}%
- Average marks: ${data.averageMarks}%
- Performance level: ${data.performanceLevel}
- Subjects: ${data.subjectBreakdown.map((s) => `${s.subject} ${s.percentage}% (${s.level})`).join(", ")}
Be constructive, specific and motivational.
Do not use placeholders like "[Student Name]" or "<name>".
Use the student's actual name naturally in the first sentence.`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 180,
      },
    });

    const content = readGeminiText(response);
    if (content) {
      // Guard against template placeholders from model output.
      if (/\[student\s*name\]|<\s*name\s*>/i.test(content)) {
        return content
          .replace(/\[student\s*name\]/gi, data.studentName)
          .replace(/<\s*name\s*>/gi, data.studentName);
      }
      return content;
    }
  } catch {
    // Fall through to rule-based summary
  }

  return data.summary;
}

export async function generateRecommendationsAI(data: ReportData): Promise<Recommendation[]> {
  const weakSubjects = data.subjectBreakdown
    .filter((s) => s.level === "WEAK")
    .map((s) => `${s.subject} (${s.percentage}%)`);
  if (weakSubjects.length === 0) return data.recommendations;

  const client = getGeminiClient();
  if (!client) return data.recommendations;

  try {
    const prompt = `A student is struggling in: ${weakSubjects.join(", ")}.
Generate 3 specific, actionable study recommendations as a JSON array:
[{"type":"study","priority":"high","message":"...","subject":"..."}]
Respond with JSON only. No markdown fences. Use only allowed values:
- type: study|attendance|exam|general
- priority: high|medium|low`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.6,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
      },
    });
    const raw = readGeminiText(response);
    if (!raw) return data.recommendations;

    const parsedUnknown = JSON.parse(stripCodeFence(raw)) as unknown;
    if (!Array.isArray(parsedUnknown)) return data.recommendations;

    const parsed = parsedUnknown.filter(isRecommendation);
    if (parsed.length === 0) return data.recommendations;

    return [...parsed, ...data.recommendations.filter((r) => r.type !== "study")];
  } catch {
    // Fall through
  }

  return data.recommendations;
}
