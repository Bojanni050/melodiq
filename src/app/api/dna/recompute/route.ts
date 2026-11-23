import { NextResponse } from "next/server";

import { resolveDnaAlias } from "@/lib/dna/alias";
import { recomputeDnaProfile } from "@/lib/dna/repository";
import { serialiseDnaProfile } from "@/lib/dna/present";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit } from "@/lib/services/rateLimitService";

// A rebuild reads up to 1500 tracks and re-derives every trait, so it gets its
// own tight budget. The page auto-builds once on first visit, which leaves
// three manual rebuilds a minute — plenty, and cheap enough to not be abusable.
const RECOMPUTE_LIMIT = 4;

/**
 * Rebuilds one tab's profile from the current catalogue. Idempotent: calling it
 * twice in a row produces the same traits. An absent or empty body targets the
 * account-wide profile, so older clients keep working.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = (await request.json().catch(() => null)) as { alias?: unknown } | null;
  const alias = await resolveDnaAlias(userId, body?.alias);
  if (alias === null) {
    return NextResponse.json({ error: "Unknown artist alias" }, { status: 400 });
  }

  // Each tab has its own budget: rebuilding five aliases in a row is a normal
  // first visit, not abuse.
  if (!checkRateLimit(`dna-recompute-${userId}-${alias}`, RECOMPUTE_LIMIT)) {
    return NextResponse.json({ error: "Too many rebuilds. Try again in a minute." }, { status: 429 });
  }

  try {
    const stored = await recomputeDnaProfile(userId, { artistAlias: alias });
    return NextResponse.json(serialiseDnaProfile(stored));
  } catch (error) {
    console.error("[dna] recompute failed", error);
    return NextResponse.json({ error: "Failed to rebuild Melody DNA" }, { status: 500 });
  }
}
