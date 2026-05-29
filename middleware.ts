import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isPublicApi = pathname.startsWith("/api/webhooks/");
  const isPwaAsset = pathname === "/manifest.webmanifest" || pathname.startsWith("/icons/");
  const isApi = pathname.startsWith("/api/");

  if (isAuthPage) {
    const payload = token ? await verifyTokenEdge(token) : null;
    if (payload) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (token) {
      const response = NextResponse.next();
      response.cookies.set("token", "", { path: "/", maxAge: 0 });
      return response;
    }
    return NextResponse.next();
  }

  if (isPublicApi || isPwaAsset) return NextResponse.next();

  if (!isApi && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isApi && token && !(await verifyTokenEdge(token))) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("token", "", { path: "/", maxAge: 0 });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
