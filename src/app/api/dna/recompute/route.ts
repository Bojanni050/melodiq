import { NextResponse } from "next/server";

import { recomputeDnaProfile } from "@/lib/dna/repository";
import { serialiseDnaProfile } from "@/lib/dna/present";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit } from "@/lib/services/rateLimitService";

// A rebuild reads up to 500 tracks and re-derives every trait, so it gets its
// own tight budget. The page auto-builds once on first visit, which leaves
// three manual rebuilds a minute — plenty, and cheap enough to not be abusable.
const RECOMPUTE_LIMIT = 4;

/**
 * Rebuilds the profile from the current catalogue. Idempotent: calling it twice
 * in a row produces the same traits.
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  if (!checkRateLimit(`dna-recompute-${userId}`, RECOMPUTE_LIMIT)) {
    return NextResponse.json({ error: "Too many rebuilds. Try again in a minute." }, { status: 429 });
  }

  try {
    const stored = await recomputeDnaProfile(userId);
    return NextResponse.json(serialiseDnaProfile(stored));
  } catch (error) {
    console.error("[dna] recompute failed", error);
    return NextResponse.json({ error: "Failed to rebuild Melody DNA" }, { status: 500 });
  }
}
