/**
 * GET /api/attendance/stream?classId=xxx
 *
 * Server-Sent Events endpoint. Keeps the connection open and pushes a
 * `attendance_updated` event whenever the mark-attendance route writes a
 * new record for the watched class.  Teachers subscribe; students trigger.
 *
 * Uses a module-level pub/sub registry so the mark route can notify all
 * open SSE connections without needing a separate message broker.
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Simple in-process pub/sub  (works in both dev and single-process prod)
// ---------------------------------------------------------------------------
type Listener = () => void;
const _listeners: Map<string, Set<Listener>> = new Map();

export function notifyClassUpdated(classId: string) {
  _listeners.get(classId)?.forEach((fn) => fn());
}

function subscribe(classId: string, fn: Listener) {
  if (!_listeners.has(classId)) _listeners.set(classId, new Set());
  _listeners.get(classId)!.add(fn);
}

function unsubscribe(classId: string, fn: Listener) {
  _listeners.get(classId)?.delete(fn);
}

// ---------------------------------------------------------------------------
// SSE route
// ---------------------------------------------------------------------------
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const classId = new URL(req.url).searchParams.get("classId");
  if (!classId) return new Response("Missing classId", { status: 400 });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial heartbeat so the browser knows the connection is live
      controller.enqueue(encoder.encode("event: connected\ndata: ok\n\n"));

      const notify = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode("event: attendance_updated\ndata: reload\n\n"));
        } catch {
          closed = true;
        }
      };

      // Heartbeat every 25 s to prevent proxy timeouts
      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return; }
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          closed = true;
          clearInterval(heartbeat);
        }
      }, 25_000);

      subscribe(classId, notify);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe(classId, notify);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
