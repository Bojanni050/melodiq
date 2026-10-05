import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isPublicApi = pathname.startsWith("/api/webhooks/");
  const isPwaAsset = pathname === "/manifest.webmanifest" || pathname.startsWith("/icons/");
  const isApi = pathname.startsWith("/api/");
  // Public routes live in the src/app/(public) route group (URLs unchanged).
  // Song DNA (Discover) and the public Explore page stay browsable while
  // logged out — see src/app/(public)/discover/page.tsx, src/app/(public)/explore/page.tsx and
  // getPublishedTrackById in src/lib/songs.ts. Their own API routes under
  // /api/discover/* are already public (no auth) server-side and pass
  // through via isApi above.
  // "/" only redirects to /discover (src/app/page.tsx), so it must be public too.
  const isPublicRoot = pathname === "/";
  const isPublicDiscover = pathname === "/discover" || pathname.startsWith("/discover/");
  const isPublicExplore = pathname === "/explore" || pathname.startsWith("/explore/");
  // Public per-alias artist pages (/artist/[slug]) with their own API routes.
  // The trailing slash is what keeps the management page /artist-pages behind
  // the login redirect — "/artist-pages" does not match "/artist/".
  const isPublicArtist = pathname.startsWith("/artist/");

  if (isAuthPage) {
    if (token && await verifyTokenEdge(token)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isPublicApi || isPwaAsset || isPublicRoot || isPublicDiscover || isPublicExplore || isPublicArtist) return NextResponse.next();

  if (!isApi && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};