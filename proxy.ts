import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const ADMIN_ONLY = [
  "/dashboard", "/prompts", "/contexts", "/templates",
  "/generate", "/profile", "/team",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login")) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const secret = process.env.SESSION_SECRET ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await verifySession(token, secret);
  if (!session) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (session.role === "assistant" && ADMIN_ONLY.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/applications", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
