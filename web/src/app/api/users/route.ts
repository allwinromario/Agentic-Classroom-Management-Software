import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const role   = searchParams.get("role");

  // ADMIN can fetch approved students (for attendance roster / enrollment)
  if (auth.role === "ADMIN") {
    if (role && role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const students = await prisma.user.findMany({
      where: { role: "STUDENT", status: status ?? "APPROVED" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        faceRegistered: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ users: students });
  }

  if (auth.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(role   ? { role }   : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      faceRegistered: true,
      faceImageB64: true,
      faceRetakeRequested: true,
      faceRetakeApproved: true,
      faceRetakeReason: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}
