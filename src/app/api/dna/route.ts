import { NextResponse } from "next/server";

import { resolveDnaAlias } from "@/lib/dna/alias";
import { getDnaProfile } from "@/lib/dna/repository";
import { serialiseDnaProfile } from "@/lib/dna/present";
import { requireAuth } from "@/lib/require-auth";

/**
 * Current Melody DNA snapshot for the signed-in user.
 *
 * `?alias=` picks the tab: empty (or absent) is the account-wide profile, any
 * other value must be one of the user's saved artist aliases. Returns
 * profile:null when that tab has never been built — the client decides whether
 * to trigger POST /api/dna/recompute or show an empty state.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const url = new URL(request.url);
  const alias = await resolveDnaAlias(userId, url.searchParams.get("alias"));
  if (alias === null) {
    return NextResponse.json({ error: "Unknown artist alias" }, { status: 400 });
  }

  try {
    const stored = await getDnaProfile(userId, alias);
    return NextResponse.json(serialiseDnaProfile(stored));
  } catch (error) {
    console.error("[dna] failed to load profile", error);
    return NextResponse.json({ error: "Failed to load Melody DNA" }, { status: 500 });
  }
}
