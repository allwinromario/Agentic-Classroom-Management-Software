import { getDb, isMongoConfigured } from "@/lib/mongo";

export type MongoStatus =
  | { mode: "unset" }
  | { mode: "ok" }
  | { mode: "error"; message: string };

export async function getMongoStatus(): Promise<MongoStatus> {
  if (!isMongoConfigured()) {
    return { mode: "unset" };
  }
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { mode: "ok" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not ping MongoDB";
    return { mode: "error", message };
  }
}
