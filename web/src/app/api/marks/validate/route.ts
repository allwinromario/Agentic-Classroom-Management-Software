import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { validateMarks } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { rows: Array<Record<string, unknown>> };

  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows array required" }, { status: 400 });
  }

  const result = validateMarks(
    body.rows.map((r, i) => ({ ...r, row: i + 1 })) as Parameters<typeof validateMarks>[0]
  );

  return NextResponse.json(result);
}
