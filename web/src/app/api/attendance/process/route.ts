import { NextResponse } from "next/server";

/**
 * Stub: forward `imageBase64` + `classId` to your Python microservice
 * (existing face_recognition pipeline) or cloud face API.
 * Do not log full base64 in production.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { classId?: string; imageBase64?: string };
    if (!body.classId || !body.imageBase64) {
      return NextResponse.json({ error: "classId and imageBase64 required" }, { status: 400 });
    }
    return NextResponse.json({
      message:
        "Stub OK. Wire this route to Python (HTTP) or move recognition to a worker. " +
        "Store only encrypted embeddings + attendance rows in MongoDB.",
      classId: body.classId,
      receivedBytes: body.imageBase64.length,
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
