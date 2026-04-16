/**
 * Run with: npx tsx fix-db.ts
 * Adds missing columns to attendances table using Prisma's raw SQL.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking attendances table columns...");

  // Check existing columns via raw SQL
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "PRAGMA table_info(attendances)"
  );
  const colNames = cols.map((c) => c.name);
  console.log("Current columns:", colNames.join(", "));

  if (!colNames.includes("latitude")) {
    await prisma.$executeRawUnsafe("ALTER TABLE attendances ADD COLUMN latitude REAL");
    console.log("✅ Added: latitude");
  } else {
    console.log("✓  latitude already exists");
  }

  if (!colNames.includes("longitude")) {
    await prisma.$executeRawUnsafe("ALTER TABLE attendances ADD COLUMN longitude REAL");
    console.log("✅ Added: longitude");
  } else {
    console.log("✓  longitude already exists");
  }

  if (!colNames.includes("locationName")) {
    await prisma.$executeRawUnsafe('ALTER TABLE attendances ADD COLUMN "locationName" TEXT');
    console.log("✅ Added: locationName");
  } else {
    console.log("✓  locationName already exists");
  }

  if (!colNames.includes("savedAt")) {
    await prisma.$executeRawUnsafe('ALTER TABLE attendances ADD COLUMN "savedAt" DATETIME');
    console.log("✅ Added: savedAt");
  } else {
    console.log("✓  savedAt already exists");
  }

  // Drop old timestamp-based unique index
  const indexes = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='attendances'"
  );
  const idxNames = indexes.map((i) => i.name);

  if (idxNames.includes("attendances_studentId_classId_timestamp_key")) {
    await prisma.$executeRawUnsafe('DROP INDEX "attendances_studentId_classId_timestamp_key"');
    console.log("🗑  Dropped old timestamp index");
  }

  if (!idxNames.includes("attendances_studentId_classId_key")) {
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX "attendances_studentId_classId_key" ON attendances(studentId, classId)'
    );
    console.log("✅ Created unique index: studentId_classId");
  } else {
    console.log("✓  Unique index studentId_classId already exists");
  }

  console.log("\n✅ Database fixed! Now run:");
  console.log("   npx prisma generate && rm -rf .next && npm run dev\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
