import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { isDnaStrength, loadDnaContext } from "@/lib/dna/context-service";

export const runtime = "nodejs";

/**
 * Preview of the hint that /api/generate appends, for surfaces that want to
 * show the user exactly what their DNA contributes (Lyrics Studio, /dna).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const raw = request.nextUrl.searchParams.get("strength");
    const strength = isDnaStrength(raw) ? raw : "subtle";

    const context = await loadDnaContext(auth.userId, strength);
    return NextResponse.json(context);
  } catch (error) {
    console.error("[dna] Failed to build DNA context:", error);
    return NextResponse.json({ error: "Failed to build Melody DNA context" }, { status: 500 });
  }
}
