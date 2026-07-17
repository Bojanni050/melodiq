import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isPublicApi = pathname.startsWith("/api/webhooks/");
  const isPwaAsset = pathname === "/manifest.webmanifest" || pathname.startsWith("/icons/");
  const isApi = pathname.startsWith("/api/");
  // Song DNA (Discover) is the one page/section that stays browsable while
  // logged out — see src/app/discover/page.tsx and getPublishedTrackById in
  // src/lib/songs.ts. Its own API routes under /api/discover/* are already
  // public (no auth) server-side and pass through via isApi above.
  const isPublicDiscover = pathname === "/discover" || pathname.startsWith("/discover/");

  if (isAuthPage) {
    if (token && await verifyTokenEdge(token)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isPublicApi || isPwaAsset || isPublicDiscover) return NextResponse.next();

  if (!isApi && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};