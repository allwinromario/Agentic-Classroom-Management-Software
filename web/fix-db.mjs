/**
 * Run with: node fix-db.mjs
 * Adds missing columns to the attendances table and removes stale unique index.
 */
import Database from "better-sqlite3";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "prisma/dev.db");

if (!existsSync(dbPath)) {
  console.error("❌  DB not found at", dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

// Helper: check if column exists
function hasColumn(table, column) {
  const cols = db.pragma(`table_info(${table})`);
  return cols.some((c) => c.name === column);
}

// Helper: check if index exists
function hasIndex(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(name);
  return !!row;
}

console.log("📦  Checking attendances table…");

const cols = [
  { name: "latitude",     sql: "ALTER TABLE attendances ADD COLUMN latitude REAL" },
  { name: "longitude",    sql: "ALTER TABLE attendances ADD COLUMN longitude REAL" },
  { name: "locationName", sql: "ALTER TABLE attendances ADD COLUMN \"locationName\" TEXT" },
];

for (const { name, sql } of cols) {
  if (!hasColumn("attendances", name)) {
    db.exec(sql);
    console.log(`  ✅  Added column: ${name}`);
  } else {
    console.log(`  ✓   Column already exists: ${name}`);
  }
}

// Drop old timestamp-based unique index if present
const oldIdx = "attendances_studentId_classId_timestamp_key";
if (hasIndex(oldIdx)) {
  db.exec(`DROP INDEX "${oldIdx}"`);
  console.log(`  🗑   Dropped old index: ${oldIdx}`);
}

// Ensure new unique index exists
const newIdx = "attendances_studentId_classId_key";
if (!hasIndex(newIdx)) {
  db.exec(`CREATE UNIQUE INDEX "${newIdx}" ON attendances(studentId, classId)`);
  console.log(`  ✅  Created unique index: ${newIdx}`);
} else {
  console.log(`  ✓   Unique index already exists: ${newIdx}`);
}

db.close();
console.log("\n✅  Database is ready. Now run:\n   npx prisma generate && rm -rf .next && npm run dev\n");
