import { NextResponse } from "next/server";

import { getDnaProfile } from "@/lib/dna/repository";
import { serialiseDnaProfile } from "@/lib/dna/present";
import { requireAuth } from "@/lib/require-auth";

/**
 * Current Melody DNA snapshot for the signed-in user.
 *
 * Returns profile:null when the user has never built one — the client decides
 * whether to trigger POST /api/dna/recompute or show an empty state.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const stored = await getDnaProfile(userId);
    return NextResponse.json(serialiseDnaProfile(stored));
  } catch (error) {
    console.error("[dna] failed to load profile", error);
    return NextResponse.json({ error: "Failed to load Melody DNA" }, { status: 500 });
  }
}
