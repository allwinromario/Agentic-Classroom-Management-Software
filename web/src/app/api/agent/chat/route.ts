import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import type { FunctionDeclaration, Schema } from "@google/genai";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Models in priority order (all supported on the v1beta API endpoint used by @google/genai).
// gemini-2.5-flash      — 20 req/day free (primary, most capable)
// gemini-2.0-flash-lite — 1,500 req/day free
// gemini-2.0-flash      — 1,500 req/day free
// gemini-2.0-flash-001  — versioned alias, separate quota bucket from the unversioned name
// NOTE: gemini-1.5-* models are NOT available on v1beta and will 404 — do not add them.
const MODEL_PRIMARY   = "gemini-2.5-flash";
const MODEL_FALLBACKS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite-001",
];

// Returns all configured API clients in priority order.
// Set GOOGLE_API_KEY_2 (and _3, _4…) in .env.local to rotate keys when
// the primary key exhausts its daily free-tier quota.
function getClients(): GoogleGenAI[] {
  const clients: GoogleGenAI[] = [];
  for (let i = 1; i <= 10; i++) {
    const varName = i === 1 ? "GOOGLE_API_KEY" : `GOOGLE_API_KEY_${i}`;
    const key = process.env[varName]?.trim();
    if (key) clients.push(new GoogleGenAI({ apiKey: key }));
  }
  return clients;
}

// Legacy single-client helper kept for the no-key guard below.
function getClient(): GoogleGenAI | null {
  const key = process.env.GOOGLE_API_KEY?.trim();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

// ── Tool declarations ──────────────────────────────────────────────────────────

function prop(type: Type, description: string): Schema {
  return { type, description };
}

function objSchema(properties: Record<string, Schema>, required: string[]): Schema {
  return { type: Type.OBJECT, properties, required };
}

const TOOLS: FunctionDeclaration[] = [
  {
    name: "search_students",
    description:
      "Search for approved students by name (partial match supported). Returns a list of matching students with their id, name, and email. Use this before entering marks or marking attendance to find the correct student ID.",
    parameters: objSchema(
      { name: prop(Type.STRING, "Student name or partial name to search for") },
      ["name"]
    ),
  },
  {
    name: "get_classes",
    description:
      "Get all classes (subjects) from approved timetables. Returns class id, subject name, day of week, start/end times, and timetable title. Use this to find the classId needed for marking attendance.",
    parameters: objSchema(
      { subject: prop(Type.STRING, "Optional subject name filter (partial match)") },
      []
    ),
  },
  {
    name: "enter_marks",
    description:
      "Enter exam marks for a student. You must have the studentId (get it via search_students first). One entry per subject. If the teacher says the max score is not specified, assume 100.",
    parameters: objSchema(
      {
        studentId: prop(Type.STRING, "The unique ID of the student"),
        entries: {
          type: Type.ARRAY,
          description: "Array of mark entries",
          items: objSchema(
            {
              subject: prop(Type.STRING, "Subject name (e.g. Mathematics)"),
              score: prop(Type.NUMBER, "Score achieved by the student"),
              maxScore: prop(Type.NUMBER, "Maximum possible score (default 100)"),
              examType: prop(Type.STRING, "One of: MIDTERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL"),
            },
            ["subject", "score", "maxScore", "examType"]
          ),
        },
      },
      ["studentId", "entries"]
    ),
  },
  {
    name: "bulk_enter_marks",
    description:
      "Enter marks for multiple students at once from a parsed CSV or tabular data. Each row maps a student name to their scores.",
    parameters: objSchema(
      {
        rows: {
          type: Type.ARRAY,
          description: "Array of student mark rows",
          items: objSchema(
            {
              studentName: prop(Type.STRING, "Student name (will be looked up automatically)"),
              subject: prop(Type.STRING, "Subject name"),
              score: prop(Type.NUMBER, "Score achieved"),
              maxScore: prop(Type.NUMBER, "Maximum possible score"),
              examType: prop(Type.STRING, "One of: MIDTERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL"),
            },
            ["studentName", "subject", "score", "maxScore", "examType"]
          ),
        },
      },
      ["rows"]
    ),
  },
  {
    name: "mark_attendance",
    description:
      "Mark attendance for a specific student in a class. You must provide the studentId (use search_students first) and classId (use get_classes first). Status must be PRESENT, ABSENT, or LATE.",
    parameters: objSchema(
      {
        studentId: prop(Type.STRING, "The unique ID of the student"),
        classId: prop(Type.STRING, "The unique ID of the class"),
        status: prop(Type.STRING, "Attendance status: PRESENT, ABSENT, or LATE"),
        remarks: prop(Type.STRING, "Optional remarks about the attendance"),
      },
      ["studentId", "classId", "status"]
    ),
  },
  {
    name: "get_student_marks",
    description:
      "Get the current marks on record for a student. Requires studentId. Use search_students first to get the ID.",
    parameters: objSchema(
      { studentId: prop(Type.STRING, "The unique ID of the student") },
      ["studentId"]
    ),
  },
  {
    name: "get_student_attendance",
    description:
      "Get the attendance records for a specific student. Requires studentId.",
    parameters: objSchema(
      { studentId: prop(Type.STRING, "The unique ID of the student") },
      ["studentId"]
    ),
  },
  {
    name: "search_classes",
    description:
      "Search for classes by subject name and optionally day of week. Returns class id, subject, day, start/end times, late threshold, and timetable info. Use this before updating a class timing.",
    parameters: objSchema(
      {
        subject: prop(Type.STRING, "Subject name or partial name to search for (e.g. 'algo', 'mathematics')"),
        dayOfWeek: prop(Type.STRING, "Optional: day filter — MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY"),
      },
      ["subject"]
    ),
  },
  {
    name: "update_class_timing",
    description:
      "Update the timing, day, or late attendance threshold of a class. After updating, the timetable is automatically set to PENDING_APPROVAL so the super admin can review and approve the change.",
    parameters: objSchema(
      {
        classId: prop(Type.STRING, "The unique ID of the class to update (get it via search_classes)"),
        startTime: prop(Type.STRING, "New start time in HH:MM 24-hour format (e.g. '20:00' for 8 PM)"),
        endTime: prop(Type.STRING, "New end time in HH:MM 24-hour format (e.g. '21:00' for 9 PM)"),
        dayOfWeek: prop(Type.STRING, "New day: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY"),
        lateThresholdMins: prop(Type.NUMBER, "Minutes after class start before a student is marked LATE (e.g. 10)"),
      },
      ["classId"]
    ),
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────

interface ToolCallArgs {
  name?: string;
  [key: string]: unknown;
}

interface BulkMarkRow {
  studentName: string;
  subject: string;
  score: number;
  maxScore: number;
  examType: string;
}

interface MarkEntry {
  subject: string;
  score: number;
  maxScore: number;
  examType: string;
}

async function executeTool(name: string, args: ToolCallArgs): Promise<unknown> {
  switch (name) {
    case "search_students": {
      const query = String(args.name ?? "");
      const students = await prisma.user.findMany({
        where: {
          role: "STUDENT",
          status: "APPROVED",
          name: { contains: query },
        },
        select: { id: true, name: true, email: true },
        take: 10,
      });
      return students.length > 0
        ? students
        : { message: `No approved students found matching "${query}"` };
    }

    case "get_classes": {
      const subjectFilter = args.subject ? String(args.subject) : undefined;
      const classes = await prisma.class.findMany({
        where: subjectFilter
          ? { subject: { contains: subjectFilter }, timetable: { status: "APPROVED" } }
          : { timetable: { status: "APPROVED" } },
        select: {
          id: true,
          subject: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          room: true,
          timetable: { select: { title: true } },
        },
        take: 20,
      });
      return classes.length > 0
        ? classes
        : { message: "No classes found in approved timetables" };
    }

    case "enter_marks": {
      const studentId = String(args.studentId ?? "");
      const entries = (args.entries ?? []) as MarkEntry[];

      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { name: true },
      });
      if (!student) return { error: `Student with ID ${studentId} not found` };

      const created = await prisma.marks.createMany({
        data: entries.map((e) => ({
          studentId,
          subject: e.subject,
          score: e.score,
          maxScore: e.maxScore ?? 100,
          examType: (e.examType ?? "MIDTERM").toUpperCase(),
        })),
      });

      return {
        success: true,
        message: `Successfully entered ${created.count} mark(s) for ${student.name}`,
        student: student.name,
        entriesAdded: created.count,
        entries: entries.map((e) => ({
          subject: e.subject,
          score: e.score,
          maxScore: e.maxScore,
          examType: e.examType,
        })),
      };
    }

    case "bulk_enter_marks": {
      const rows = (args.rows ?? []) as BulkMarkRow[];
      const results: Array<{ student: string; status: string; error?: string }> = [];
      let totalAdded = 0;

      for (const row of rows) {
        const students = await prisma.user.findMany({
          where: {
            role: "STUDENT",
            status: "APPROVED",
            name: { contains: row.studentName },
          },
          select: { id: true, name: true },
          take: 1,
        });

        if (students.length === 0) {
          results.push({ student: row.studentName, status: "not_found", error: "Student not found" });
          continue;
        }

        const student = students[0];
        await prisma.marks.create({
          data: {
            studentId: student.id,
            subject: row.subject,
            score: row.score,
            maxScore: row.maxScore ?? 100,
            examType: (row.examType ?? "MIDTERM").toUpperCase(),
          },
        });
        totalAdded++;
        results.push({ student: student.name, status: "success" });
      }

      return {
        success: true,
        message: `Bulk marks entry complete. ${totalAdded} of ${rows.length} records added successfully.`,
        totalAdded,
        results,
      };
    }

    case "mark_attendance": {
      const studentId = String(args.studentId ?? "");
      const classId = String(args.classId ?? "");
      const status = String(args.status ?? "PRESENT").toUpperCase();
      const remarks = args.remarks ? String(args.remarks) : "Marked by AI assistant";

      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { name: true },
      });
      if (!student) return { error: `Student with ID ${studentId} not found` };

      const cls = await prisma.class.findUnique({
        where: { id: classId },
        select: { subject: true },
      });
      if (!cls) return { error: `Class with ID ${classId} not found` };

      const existing = await prisma.attendance.findUnique({
        where: { studentId_classId: { studentId, classId } },
      });

      const { randomBytes } = await import("crypto");
      if (existing) {
        await prisma.$executeRawUnsafe(
          `UPDATE attendances SET status = ?, remarks = ? WHERE studentId = ? AND classId = ?`,
          status, remarks, studentId, classId
        );
      } else {
        const newId = "c" + randomBytes(11).toString("base64url").slice(0, 24);
        await prisma.$executeRawUnsafe(
          `INSERT INTO attendances (id, studentId, classId, status, timestamp, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
          newId, studentId, classId, status, new Date().toISOString(), remarks
        );
      }

      return {
        success: true,
        message: `Attendance marked as ${status} for ${student.name} in ${cls.subject}`,
        student: student.name,
        subject: cls.subject,
        status,
        action: existing ? "updated" : "created",
      };
    }

    case "get_student_marks": {
      const studentId = String(args.studentId ?? "");
      const marks = await prisma.marks.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      if (marks.length === 0) return { message: "No marks found for this student" };
      return marks.map((m) => ({
        subject: m.subject,
        score: m.score,
        maxScore: m.maxScore,
        percentage: Math.round((m.score / m.maxScore) * 100),
        examType: m.examType,
      }));
    }

    case "get_student_attendance": {
      const studentId = String(args.studentId ?? "");
      type AttRow = { status: string; subject: string; timestamp: string };
      const rows = await prisma.$queryRawUnsafe<AttRow[]>(
        `SELECT a.status, c.subject, a.timestamp FROM attendances a JOIN classes c ON a.classId = c.id WHERE a.studentId = ? ORDER BY a.timestamp DESC LIMIT 20`,
        studentId
      );
      if (rows.length === 0) return { message: "No attendance records found for this student" };
      const present = rows.filter((r) => r.status === "PRESENT").length;
      const total = rows.length;
      return {
        totalRecords: total,
        presentCount: present,
        attendancePercentage: Math.round((present / total) * 100),
        records: rows,
      };
    }

    case "search_classes": {
      const subjectQuery = String(args.subject ?? "");
      const dayFilter = args.dayOfWeek ? String(args.dayOfWeek).toUpperCase() : undefined;

      const classes = await prisma.class.findMany({
        where: {
          subject: { contains: subjectQuery },
          ...(dayFilter ? { dayOfWeek: dayFilter } : {}),
        },
        select: {
          id: true,
          subject: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          lateThresholdMins: true,
          room: true,
          timetable: { select: { id: true, title: true, status: true } },
        },
        take: 10,
      });

      if (classes.length === 0) {
        return { message: `No classes found matching "${subjectQuery}"${dayFilter ? ` on ${dayFilter}` : ""}` };
      }
      return classes;
    }

    case "update_class_timing": {
      const classId = String(args.classId ?? "");

      const existing = await prisma.class.findUnique({
        where: { id: classId },
        include: { timetable: { select: { id: true, title: true, status: true } } },
      });
      if (!existing) return { error: `Class with ID ${classId} not found` };

      // Build update payload — only include fields that were provided
      const updates: Record<string, unknown> = {};
      if (args.startTime)          updates.startTime         = String(args.startTime);
      if (args.endTime)            updates.endTime           = String(args.endTime);
      if (args.dayOfWeek)          updates.dayOfWeek         = String(args.dayOfWeek).toUpperCase();
      if (args.lateThresholdMins != null) updates.lateThresholdMins = Number(args.lateThresholdMins);

      if (Object.keys(updates).length === 0) {
        return { error: "No timing fields provided to update." };
      }

      await prisma.class.update({ where: { id: classId }, data: updates });

      // Set parent timetable to PENDING_APPROVAL so super admin reviews the change
      await prisma.timetable.update({
        where: { id: existing.timetableId },
        data: { status: "PENDING_APPROVAL" },
      });

      return {
        success: true,
        message: `Class "${existing.subject}" timing updated and timetable "${existing.timetable.title}" submitted for approval.`,
        subject: existing.subject,
        timetableTitle: existing.timetable.title,
        previousTiming: { day: existing.dayOfWeek, start: existing.startTime, end: existing.endTime, lateThresholdMins: existing.lateThresholdMins },
        newTiming: {
          day: (updates.dayOfWeek as string) ?? existing.dayOfWeek,
          start: (updates.startTime as string) ?? existing.startTime,
          end: (updates.endTime as string) ?? existing.endTime,
          lateThresholdMins: (updates.lateThresholdMins as number) ?? existing.lateThresholdMins,
        },
        status: "PENDING_APPROVAL",
        note: "The super admin will review and approve this change.",
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an intelligent classroom management assistant for teachers at SCMS (Smart Classroom Management System). You help teachers automate administrative tasks through natural conversation.

Your capabilities:
- **Marks Entry**: Enter marks for students for any subject — individually or from a CSV file.
- **Attendance Marking**: Mark attendance (PRESENT/ABSENT/LATE) for specific students in specific classes.
- **Class Timing Updates**: Change the start time, end time, day of week, or late attendance threshold of any class. After updating, the timetable is automatically submitted for super admin approval.
- **Data Lookup**: Look up student info, class schedules, marks, and attendance records.

Behavior guidelines:
- **Execute immediately — never ask "Shall I proceed?" or any confirmation question before writing data.** The teacher's instruction is the confirmation. Call the tool right away.
- For timing changes: use search_classes to find the class, then immediately call update_class_timing — do not pause to ask.
- Times must be in 24-hour HH:MM format — convert naturally (e.g. "8 PM" → "20:00", "9 PM" → "21:00").
- Days must be uppercase: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY.
- After updating a class timing, always mention that it has been submitted for super admin approval.
- If multiple classes match a subject name, list the options briefly and ask which one — this is a necessary disambiguation, not a confirmation.
- If multiple students match a name, list the options briefly and ask which one — same reason.
- Be concise, helpful, and professional.

Exam types: MIDTERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL
Attendance statuses: PRESENT, ABSENT, LATE`;

// ── Route handler ─────────────────────────────────────────────────────────────

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentAction {
  type: "marks_entered" | "attendance_marked" | "bulk_marks_entered" | "class_timing_updated";
  details: unknown;
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden — teachers only" }, { status: 403 });
  }

  const primaryClient = getClient();
  if (!primaryClient) {
    return NextResponse.json(
      { reply: "AI service is not configured. Please ask your administrator to set GOOGLE_API_KEY.", actions: [] },
      { status: 200 }
    );
  }

  const body = await req.json() as {
    message: string;
    history?: AgentMessage[];
    csvData?: Array<Record<string, string>>;
  };

  const userMessage = String(body.message ?? "").trim();
  if (!userMessage) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  // Build Gemini conversation contents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [];

  // Inject history
  for (const msg of body.history ?? []) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  // Current user message — append CSV data if provided
  let fullUserMessage = userMessage;
  if (body.csvData && body.csvData.length > 0) {
    const csvStr = body.csvData
      .map((row) => Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(", "))
      .join("\n");
    fullUserMessage += `\n\n[CSV Data Uploaded - ${body.csvData.length} rows]:\n${csvStr}`;
  }
  contents.push({ role: "user", parts: [{ text: fullUserMessage }] });

  const allClients = getClients();
  const actions: AgentAction[] = [];

  // Quota/availability error — try the next (model, key) pair.
  const isQuotaOrAvailability = (msg: string) =>
    msg.includes("503") || msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") || msg.includes("overloaded") ||
    msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota exceeded") || msg.includes("limit: 0");

  // Model not found on this API version — skip to next model, but don't abort.
  const isModelNotFound = (msg: string) =>
    msg.includes("NOT_FOUND") || msg.includes("404") || msg.includes("not found for API version");

  // Helper — try every (model × client) combination until one succeeds.
  // Aborts early only on a genuine API/auth error (not quota or model-not-found).
  const callBestAvailable = async (
    conts: typeof contents
  ): Promise<{ response: unknown; ok: true } | { ok: false; lastMsg: string }> => {
    let lastMsg = "";
    const modelsToTry = [MODEL_PRIMARY, ...MODEL_FALLBACKS];
    for (const model of modelsToTry) {
      for (const client of allClients) {
        try {
          const response = await client.models.generateContent({
            model,
            contents: conts,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              tools: [{ functionDeclarations: TOOLS }],
              temperature: 0.3,
              maxOutputTokens: 1024,
            },
          });
          return { response, ok: true };
        } catch (err) {
          lastMsg = err instanceof Error ? err.message : String(err);
          const keyIdx = allClients.indexOf(client) + 1;
          const label = model === MODEL_PRIMARY ? "Primary" : `Fallback (${model})`;
          console.error(`[agent/chat] ${label} key#${keyIdx} error:`, lastMsg);

          if (isModelNotFound(lastMsg)) break; // this model doesn't exist → skip to next model
          if (!isQuotaOrAvailability(lastMsg)) return { ok: false, lastMsg }; // hard error → abort
          // quota/availability → try next key for same model, then next model
        }
      }
    }
    return { ok: false, lastMsg };
  };

  // Extract retry-after seconds from a Gemini 429 body
  const parseRetryDelay = (msg: string): number | null => {
    const m = msg.match(/retry[^\d]*(\d+(?:\.\d+)?)s/i);
    return m ? Math.ceil(Number(m[1])) : null;
  };

  // Agentic loop — handle multi-step tool calls
  let iterCount = 0;
  const MAX_ITER = 6;

  while (iterCount < MAX_ITER) {
    iterCount++;

    const result = await callBestAvailable(contents);

    if (!result.ok) {
      const delaySec = parseRetryDelay(result.lastMsg);
      const isQuota = isQuotaOrAvailability(result.lastMsg);
      const reply = isQuota
        ? delaySec
          ? `The AI has hit its daily free-tier limit on all models. Quota resets daily — try again later, or add a GOOGLE_API_KEY_2 in .env.local for extra quota.`
          : "All AI models are currently at capacity. Please wait a moment and try again."
        : "The AI service returned an error. Please try again.";
      return NextResponse.json({ reply, actions });
    }

    const response = result.response;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidate = (response as any)?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    // Check for function calls in this response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functionCalls = parts.filter((p: any) => p.functionCall);

    if (functionCalls.length === 0) {
      // No tool calls — extract final text response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textParts = parts.filter((p: any) => p.text);
      const finalText = textParts.map((p: { text: string }) => p.text).join("").trim();

      // Save to chat history
      await prisma.chatMessage.create({
        data: { userId: auth.userId, content: userMessage, role: "user", source: "agent" },
      });
      await prisma.chatMessage.create({
        data: { userId: auth.userId, content: finalText, role: "assistant", source: "agent" },
      });

      return NextResponse.json({ reply: finalText, actions });
    }

    // Execute tool calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResults: any[] = [];

    for (const part of functionCalls) {
      const fnCall = part.functionCall;
      const toolName = fnCall.name as string;
      const toolArgs = (fnCall.args ?? {}) as ToolCallArgs;

      let result: unknown;
      try {
        result = await executeTool(toolName, toolArgs);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Tool execution failed" };
      }

      // Track significant actions for the UI
      if (toolName === "enter_marks" && (result as { success?: boolean }).success) {
        actions.push({ type: "marks_entered", details: result });
      }
      if (toolName === "bulk_enter_marks" && (result as { success?: boolean }).success) {
        actions.push({ type: "bulk_marks_entered", details: result });
      }
      if (toolName === "mark_attendance" && (result as { success?: boolean }).success) {
        actions.push({ type: "attendance_marked", details: result });
      }
      if (toolName === "update_class_timing" && (result as { success?: boolean }).success) {
        actions.push({ type: "class_timing_updated", details: result });
      }

      toolResults.push({
        functionResponse: {
          name: toolName,
          response: { content: JSON.stringify(result) },
        },
      });
    }

    // Add model's response (with function calls) to contents
    contents.push({ role: "model", parts });

    // Add function responses
    contents.push({ role: "user", parts: toolResults });
  }

  // Fallback if loop exceeded
  return NextResponse.json({
    reply: "I processed your request but ran into a loop. Please try again with a simpler query.",
    actions,
  });
}

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await prisma.chatMessage.findMany({
    where: { userId: auth.userId, source: "agent" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ messages });
}
