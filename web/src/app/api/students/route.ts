import { NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/mongo";
import { serializeMongoDoc } from "@/lib/serializeMongoDoc";

export async function GET(req: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { status: "error", message: "MONGODB_URI is not set. Add it to .env.local" },
      { status: 503 },
    );
  }

  const classId = new URL(req.url).searchParams.get("class_id");
  const query = classId ? { class_id: classId } : {};

  try {
    const db = await getDb();
    const students = await db
      .collection("students")
      .find(query)
      .project({ _id: 1, name: 1, student_id: 1, class_id: 1 })
      .toArray();

    return NextResponse.json({
      status: "success",
      data: serializeMongoDoc(students),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
