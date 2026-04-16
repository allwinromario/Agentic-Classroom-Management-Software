/**
 * Database seed script — creates a SUPER_ADMIN and demo data.
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@scms.edu" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@scms.edu",
      password: await bcrypt.hash("superadmin123", 12),
      role: "SUPER_ADMIN",
      status: "APPROVED",
    },
  });
  console.log(`✅ Super Admin: ${superAdmin.email}`);

  // Demo Teacher
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@scms.edu" },
    update: {},
    create: {
      name: "Ms. Johnson",
      email: "teacher@scms.edu",
      password: await bcrypt.hash("teacher123", 12),
      role: "ADMIN",
      status: "APPROVED",
    },
  });
  console.log(`✅ Teacher: ${teacher.email}`);

  // Demo Students
  const student1 = await prisma.user.upsert({
    where: { email: "student1@scms.edu" },
    update: {},
    create: {
      name: "Alex Chen",
      email: "student1@scms.edu",
      password: await bcrypt.hash("student123", 12),
      role: "STUDENT",
      status: "APPROVED",
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: "student2@scms.edu" },
    update: {},
    create: {
      name: "Priya Patel",
      email: "student2@scms.edu",
      password: await bcrypt.hash("student123", 12),
      role: "STUDENT",
      status: "APPROVED",
    },
  });
  console.log(`✅ Students: ${student1.email}, ${student2.email}`);

  // Demo Timetable
  const timetable = await prisma.timetable.upsert({
    where: { id: "demo-timetable-1" },
    update: {},
    create: {
      id: "demo-timetable-1",
      title: "Class 10 — Term 1 2025",
      description: "Monday to Friday schedule for Class 10",
      status: "APPROVED",
      createdById: teacher.id,
      classes: {
        create: [
          { subject: "Mathematics", room: "101", dayOfWeek: "MONDAY", startTime: "09:00", endTime: "10:00" },
          { subject: "Physics", room: "Lab 1", dayOfWeek: "MONDAY", startTime: "10:30", endTime: "11:30" },
          { subject: "English", room: "202", dayOfWeek: "TUESDAY", startTime: "09:00", endTime: "10:00" },
          { subject: "Chemistry", room: "Lab 2", dayOfWeek: "TUESDAY", startTime: "11:00", endTime: "12:00" },
          { subject: "Biology", room: "301", dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "10:00" },
          { subject: "Mathematics", room: "101", dayOfWeek: "WEDNESDAY", startTime: "11:00", endTime: "12:00" },
          { subject: "Computer Science", room: "CS Lab", dayOfWeek: "THURSDAY", startTime: "09:00", endTime: "10:30" },
          { subject: "English", room: "202", dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "10:00" },
          { subject: "Physics", room: "Lab 1", dayOfWeek: "FRIDAY", startTime: "11:00", endTime: "12:00" },
        ],
      },
    },
  });
  console.log(`✅ Timetable: ${timetable.title}`);

  // Sample attendance records
  const classes = await prisma.class.findMany({ where: { timetableId: timetable.id } });
  for (const cls of classes.slice(0, 7)) {
    await prisma.attendance.upsert({
      where: { studentId_classId: { studentId: student1.id, classId: cls.id } },
      update: {},
      create: {
        studentId: student1.id,
        classId: cls.id,
        status: Math.random() > 0.2 ? "PRESENT" : "ABSENT",
        timestamp: new Date(),
      },
    });
    await prisma.attendance.upsert({
      where: { studentId_classId: { studentId: student2.id, classId: cls.id } },
      update: {},
      create: {
        studentId: student2.id,
        classId: cls.id,
        status: Math.random() > 0.35 ? "PRESENT" : "ABSENT",
        timestamp: new Date(),
      },
    });
  }
  console.log(`✅ Sample attendance seeded`);

  // Demo marks — student1 (good performer), student2 (mixed)
  const marksS1 = [
    { subject: "Mathematics",    score: 82, maxScore: 100, examType: "MIDTERM" },
    { subject: "Physics",        score: 76, maxScore: 100, examType: "MIDTERM" },
    { subject: "English",        score: 88, maxScore: 100, examType: "MIDTERM" },
    { subject: "Chemistry",      score: 64, maxScore: 100, examType: "MIDTERM" },
    { subject: "Biology",        score: 71, maxScore: 100, examType: "MIDTERM" },
    { subject: "Computer Science", score: 93, maxScore: 100, examType: "MIDTERM" },
  ];
  const marksS2 = [
    { subject: "Mathematics",    score: 38, maxScore: 100, examType: "MIDTERM" },
    { subject: "Physics",        score: 52, maxScore: 100, examType: "MIDTERM" },
    { subject: "English",        score: 65, maxScore: 100, examType: "MIDTERM" },
    { subject: "Chemistry",      score: 29, maxScore: 100, examType: "MIDTERM" },
    { subject: "Biology",        score: 45, maxScore: 100, examType: "MIDTERM" },
    { subject: "Computer Science", score: 58, maxScore: 100, examType: "MIDTERM" },
  ];

  for (const m of marksS1) {
    const existing = await prisma.marks.findFirst({ where: { studentId: student1.id, subject: m.subject, examType: m.examType } });
    if (!existing) await prisma.marks.create({ data: { studentId: student1.id, ...m } });
  }
  for (const m of marksS2) {
    const existing = await prisma.marks.findFirst({ where: { studentId: student2.id, subject: m.subject, examType: m.examType } });
    if (!existing) await prisma.marks.create({ data: { studentId: student2.id, ...m } });
  }
  console.log(`✅ Demo marks seeded`);

  console.log("\n🎉 Seed complete! Demo credentials:");
  console.log("   Super Admin : superadmin@scms.edu / superadmin123");
  console.log("   Teacher     : teacher@scms.edu / teacher123");
  console.log("   Student     : student1@scms.edu / student123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
