import { ObjectId, type Document } from "mongodb";

/** Recursively turn BSON types into JSON-safe values (matches Python serialize_object). */
export function serializeMongoDoc<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").slice(0, 19) as T;
  }
  if (value instanceof ObjectId) {
    return value.toHexString() as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeMongoDoc(item)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Document)) {
      out[k] = serializeMongoDoc(v);
    }
    return out as T;
  }
  return value;
}
