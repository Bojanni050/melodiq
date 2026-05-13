import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./src/lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const isAuthPage =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/register";
  const isApiPage = request.nextUrl.pathname.startsWith("/api");

  if (isAuthPage) {
    if (token && verifyToken(token)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!isApiPage && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
