import { NextResponse } from "next/server";

import { recomputeDnaProfile } from "@/lib/dna/repository";
import { serialiseDnaProfile } from "@/lib/dna/present";
import { requireAuth } from "@/lib/require-auth";

/**
 * Rebuilds the profile from the current catalogue. Idempotent: calling it twice
 * in a row produces the same traits. Phase 2 wires this to the page/refresh
 * button; phase 1 exposes it so the pipeline can be verified end to end.
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const stored = await recomputeDnaProfile(userId);
    return NextResponse.json(serialiseDnaProfile(stored));
  } catch (error) {
    console.error("[dna] recompute failed", error);
    return NextResponse.json({ error: "Failed to rebuild Melody DNA" }, { status: 500 });
  }
}
