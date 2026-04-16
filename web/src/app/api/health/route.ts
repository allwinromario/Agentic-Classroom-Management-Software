import { NextResponse } from "next/server";
import { getMongoStatus } from "@/lib/mongoStatus";

export async function GET() {
  const mongo = await getMongoStatus();
  return NextResponse.json({
    ok: true,
    service: "scms-web",
    mongo: mongo.mode === "unset" ? "not_configured" : mongo.mode === "ok" ? "connected" : "error",
    mongoDetail: mongo.mode === "error" ? mongo.message : undefined,
  });
}
