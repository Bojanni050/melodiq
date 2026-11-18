import { NextResponse } from "next/server";

import { serialiseDnaProfile } from "@/lib/dna/present";
import { getDnaProfile, setTraitLock } from "@/lib/dna/repository";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit } from "@/lib/services/rateLimitService";

// Pinning is a deliberate click, not a batch job; the cap only stops a runaway
// client from hammering the trait table.
const LOCK_LIMIT = 30;

/**
 * Pins or unpins one trait ("this is right, stop re-deriving it").
 *
 * A pinned trait survives the next recompute (see lib/dna/history.ts), which is
 * what makes a correction stick. The response carries the same payload as
 * GET /api/dna so the page can replace its state in one round-trip.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  if (!checkRateLimit(`dna-lock-${userId}`, LOCK_LIMIT)) {
    return NextResponse.json({ error: "Too many lock changes. Try again in a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as { traitKey?: unknown; locked?: unknown };
  const traitKey = typeof payload.traitKey === "string" ? payload.traitKey.trim() : "";
  const locked = payload.locked !== false;

  if (!traitKey || traitKey.length > 60) {
    return NextResponse.json({ error: "A valid traitKey is required" }, { status: 400 });
  }

  try {
    const updated = await setTraitLock(userId, traitKey, locked);
    if (!updated) {
      return NextResponse.json({ error: "Unknown trait for this profile" }, { status: 404 });
    }

    const stored = await getDnaProfile(userId);
    return NextResponse.json(serialiseDnaProfile(stored));
  } catch (error) {
    console.error("[dna] failed to change a trait lock", error);
    return NextResponse.json({ error: "Failed to change the trait lock" }, { status: 500 });
  }
}
