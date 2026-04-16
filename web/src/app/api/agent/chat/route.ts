import { NextResponse } from "next/server";

/** Stub: call Gemini with tool definitions mirroring read_data / write_data / reports */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string };
    const msg = body.message?.trim();
    if (!msg) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }
    return NextResponse.json({
      reply:
        "Stub: connect to your model (e.g. Gemini) with structured tools for marks and report generation. " +
        `You said: ${msg.slice(0, 200)}${msg.length > 200 ? "…" : ""}`,
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
