/**
 * Server-side proxy for the Python face recognition service.
 * Eliminates ERR_CONNECTION_REFUSED in the browser and enforces face-lock logic.
 *
 * GET  /api/ai-service?path=/health
 * POST /api/ai-service?path=/register-face    STUDENT (once, or approved retake)
 * POST /api/ai-service?path=/verify-face      STUDENT (1:1 liveness check)
 * POST /api/ai-service?path=/mark-attendance  ADMIN   (1:N classroom scan)
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SVC_URL =
  process.env.ATTENDANCE_SERVICE_URL ??
  process.env.NEXT_PUBLIC_ATTENDANCE_SERVICE_URL ??
  "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 8_000;

async function proxyRequest(path: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${SVC_URL}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/health";
  try {
    const upstream = await proxyRequest(path, undefined, 5_000);
    const data = await upstream.json();
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json(
      { ok: false, status: "offline", message: "Python service not reachable" },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/verify-face";

  const rawBody = await req.text();
  let forwardBody = rawBody;
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  // ------------------------------------------------------------------ //
  // /register-face — student only, enforce one-time lock
  // ------------------------------------------------------------------ //
  if (path === "/register-face") {
    if (auth.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Enforce lock: already registered and no approved retake
    if (student.faceRegistered && !student.faceRetakeApproved) {
      return NextResponse.json(
        {
          error: "Face already registered",
          locked: true,
          message:
            "Your face is already registered. To update it, request a retake via the AI Assistant.",
        },
        { status: 409 }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const imageBase64 = (payload.imageBase64 ?? payload.image) as string | undefined;
    if (!imageBase64) return NextResponse.json({ error: "Missing image data" }, { status: 400 });

    forwardBody = JSON.stringify({ studentId: auth.userId, imageBase64 });
    timeoutMs = 120_000;

    try {
      const upstream = await proxyRequest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: forwardBody,
      }, timeoutMs);

      const data = await upstream.json() as { success?: boolean; [k: string]: unknown };

      if (upstream.ok && data.success) {
        // Persist registration flag + thumbnail for Super Admin preview.
        const rawB64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        await prisma.user.update({
          where: { id: auth.userId },
          data: {
            faceRegistered: true,
            faceImageB64: rawB64,
            faceRetakeApproved: false,
            faceRetakeReason: null,
          },
        });
        // Hot-reload the AI service embedding cache so verify-face works immediately
        try {
          await proxyRequest("/reload-embeddings", { method: "POST" }, 5_000);
        } catch {
          // non-critical
        }
      }

      return NextResponse.json(data, { status: upstream.status });
    } catch {
      return NextResponse.json(
        { ok: false, message: "AI service is offline. Try again once the Python service is running." },
        { status: 503 }
      );
    }
  }

  // ------------------------------------------------------------------ //
  // /verify-face — student self-identifies before marking attendance
  // ------------------------------------------------------------------ //
  if (path === "/verify-face") {
    if (auth.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!student?.faceRegistered) {
      return NextResponse.json(
        { error: "No face registered. Please register your face first.", verified: false },
        { status: 400 }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const imageBase64 = (payload.imageBase64 ?? payload.image) as string | undefined;
    if (!imageBase64) return NextResponse.json({ error: "Missing image data" }, { status: 400 });

    forwardBody = JSON.stringify({
      studentId: auth.userId,
      imageBase64,
      antiSpoofing: payload.antiSpoofing ?? false,
    });
    timeoutMs = 60_000;

    try {
      const upstream = await proxyRequest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: forwardBody,
      }, timeoutMs);

      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch {
      return NextResponse.json(
        { verified: false, ok: false, message: "AI service offline. Cannot verify face." },
        { status: 503 }
      );
    }
  }

  // ------------------------------------------------------------------ //
  // /mark-attendance — admin classroom scan (1:N)
  // ------------------------------------------------------------------ //
  if (path === "/mark-attendance") {
    if (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    timeoutMs = 60_000;

    try {
      const upstream = await proxyRequest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody,
      }, timeoutMs);

      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch {
      return NextResponse.json(
        {
          ok: false,
          detected_students: [],
          face_count: 0,
          message: "Python AI service is offline. Use manual marking.",
        },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown path" }, { status: 400 });
}
