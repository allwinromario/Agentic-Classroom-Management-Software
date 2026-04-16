import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const chatSchema = z.object({ message: z.string().min(1).max(1000) });

interface ChatContext {
  name: string;
  role: string;
  status: string;
  faceRegistered?: boolean;
  faceRetakeRequested?: boolean;
}

// Regex to detect "requesting a retake" intent
const RETAKE_INTENT = /retake|re-register|update (my )?photo|change (my )?face|new (face )?photo|re-?take photo/i;

// Extract reason: user may say "request retake because my glasses changed" etc.
const REASON_PREFIX = /(?:because|reason:|since|my|as)\s+/i;

const RULES: Array<{ pattern: RegExp; reply: (ctx: ChatContext) => string }> = [
  {
    pattern: /timetable|schedule|class(es)?|today/i,
    reply: (ctx) =>
      `Hi ${ctx.name}! View your timetable in the **Timetable** section. Approved schedules show all your weekly classes. Tap any class to mark your attendance with a face scan.`,
  },
  {
    pattern: /attendance|present|absent/i,
    reply: (ctx) =>
      ctx.role === "STUDENT"
        ? `Your attendance records are in the **Attendance** section. To mark attendance, go to **Timetable** and tap the class you want — the system will scan your face to verify your identity.`
        : `As a teacher, you can mark attendance manually from the **Attendance** page. Students mark their own attendance via face scan from their timetable.`,
  },
  {
    pattern: /face (id|scan|recognition)|register (face|photo)/i,
    reply: (ctx) =>
      ctx.role === "STUDENT"
        ? ctx.faceRegistered
          ? `Your face is already registered and **locked** for security. If you need to update it (e.g. glasses, appearance change), type **"request retake"** and give me a reason — I'll alert your teacher.`
          : `You don't have a face registered yet. This was required during sign-up. Contact your teacher or Super Admin for help.`
        : `The face recognition system lets students mark their own attendance via webcam. They tap a class in their timetable and verify their face. The AI uses ArcFace for high-accuracy matching.`,
  },
  {
    pattern: /approve|pending|status/i,
    reply: (ctx) =>
      ctx.role === "STUDENT" || ctx.role === "ADMIN"
        ? `Your account status is **${ctx.status}**. ${
            ctx.status === "PENDING" ? "Please wait for a Super Admin to approve your account." :
            ctx.status === "APPROVED" ? "You have full access." :
            "Your account was rejected. Contact the administrator."
          }`
        : `The approval queue is in **User Management**. Approve or reject pending users there.`,
  },
  {
    pattern: /enroll|class roster|students in class/i,
    reply: () =>
      `Teachers can enroll specific students in each class from the **Timetable** page. Once a timetable is approved, hover over any class and click the students icon to manage the roster.`,
  },
  {
    pattern: /help|what can you do|commands/i,
    reply: () =>
      `I can help with:\n- **Timetable** queries\n- **Attendance** info\n- **Face ID** — request a retake if needed\n- **Account status**\n- **Navigation** help\n\nJust ask me anything!`,
  },
  {
    pattern: /hello|hi|hey|good morning|good afternoon/i,
    reply: (ctx) => `Hello ${ctx.name}! I'm your SCMS assistant. How can I help you today?`,
  },
  {
    pattern: /dashboard|home/i,
    reply: (ctx) => `Your dashboard is at **/${ctx.role.toLowerCase().replace("_", "-")}** — it shows your key stats and today's schedule.`,
  },
  {
    pattern: /alert|emergency|notification/i,
    reply: () =>
      `Emergency alerts are broadcast to all users in real-time. Teachers can trigger them from the **Alerts** page. Active alerts appear as banners at the top of every page.`,
  },
];

function getAIReply(message: string, ctx: ChatContext): string {
  // Retake intent — handled separately in POST handler
  for (const rule of RULES) {
    if (rule.pattern.test(message)) return rule.reply(ctx);
  }
  return `I'm not sure about that. Try asking about your **timetable**, **attendance**, **face ID**, or type **"help"** for a list of things I can do.`;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await prisma.chatMessage.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { message } = chatSchema.parse(body);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, role: true, status: true, faceRegistered: true, faceRetakeRequested: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Save user message
  await prisma.chatMessage.create({ data: { userId: auth.userId, content: message, role: "user" } });

  const ctx: ChatContext = {
    name: user.name,
    role: user.role,
    status: user.status,
    faceRegistered: user.faceRegistered,
    faceRetakeRequested: user.faceRetakeRequested,
  };

  let botReply = "";

  // ── Retake request flow ──────────────────────────────────────────────
  if (RETAKE_INTENT.test(message) && user.role === "STUDENT") {
    if (!user.faceRegistered) {
      botReply = "You don't have a face registered yet, so a retake isn't applicable. Please contact your Super Admin for help setting up your face ID.";
    } else if (user.faceRetakeRequested) {
      botReply = "You already have a pending retake request. Your teacher has been notified — please wait for their approval.";
    } else {
      // Extract reason from the message
      const cleaned = message.replace(RETAKE_INTENT, "").replace(REASON_PREFIX, "").trim();
      const reason = cleaned.length >= 10
        ? cleaned
        : null;

      if (!reason) {
        botReply = `I'll help you request a face photo retake.\n\nPlease tell me **why** you need a new photo (e.g. "I got glasses", "my appearance changed"). Include this in your message like:\n> *request retake because [your reason]*`;
      } else {
        // Submit retake request automatically
        try {
          await prisma.user.update({
            where: { id: auth.userId },
            data: { faceRetakeRequested: true, faceRetakeReason: reason },
          });
          // Alert to all teachers/admins
          await prisma.alert.create({
            data: {
              title: "Face Retake Request",
              message: `Student **${user.name}** has requested a face photo retake.\nReason: "${reason}"`,
              severity: "warning",
              active: true,
              createdById: auth.userId,
            },
          });
          botReply = `✅ Done! Your retake request has been submitted with the reason:\n> *"${reason}"*\n\nYour teacher has been notified. Once they approve it, you'll see a **one-time photo update option** on your dashboard. I'll be here if you need anything else!`;
        } catch {
          botReply = "Something went wrong submitting your request. Please try again.";
        }
      }
    }
  } else {
    botReply = getAIReply(message, ctx);
  }

  const saved = await prisma.chatMessage.create({ data: { userId: auth.userId, content: botReply, role: "assistant" } });
  return NextResponse.json({ message: saved });
}
