import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deletedUsers = await prisma.deletedUser.findMany({
    orderBy: { deletedAt: "desc" },
  });

  return NextResponse.json({ deletedUsers });
}
