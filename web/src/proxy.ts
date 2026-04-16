import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth/login", "/api/auth/register", "/api/alerts"];
const AUTH_PATHS = ["/login", "/register"];
const ROLE_PATHS: Record<string, string[]> = {
  SUPER_ADMIN: ["/super-admin"],
  ADMIN: ["/admin"],
  STUDENT: ["/student"],
};

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("scms_token")?.value;
  const user = token ? verifyToken(token) : null;

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    if (user && user.status === "APPROVED") {
      const rolePath = ROLE_PATHS[user.role]?.[0] ?? "/";
      return NextResponse.redirect(new URL(rolePath, req.url));
    }
    return NextResponse.next();
  }

  if (!PUBLIC_PATHS.includes(pathname) && !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (user && user.status !== "APPROVED") {
    const isRolePath = Object.values(ROLE_PATHS)
      .flat()
      .some((p) => pathname.startsWith(p));
    if (isRolePath) {
      return NextResponse.redirect(new URL("/pending", req.url));
    }
  }

  if (user) {
    for (const [role, paths] of Object.entries(ROLE_PATHS)) {
      if (paths.some((p) => pathname.startsWith(p)) && user.role !== role) {
        const allowedPath = ROLE_PATHS[user.role]?.[0] ?? "/";
        return NextResponse.redirect(new URL(allowedPath, req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
