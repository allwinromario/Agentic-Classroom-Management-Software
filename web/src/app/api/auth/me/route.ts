import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    const res = NextResponse.json({ error: "Account no longer exists" }, { status: 404 });
    res.cookies.set("auth-token", "", { maxAge: 0, path: "/" });
    return res;
  }

  return NextResponse.json({ user });
}
