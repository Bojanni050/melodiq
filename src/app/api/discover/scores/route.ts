import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyToken } from "@/lib/auth";
import { getAccessibleTrackIds, getTrackDnaOverallScores } from "@/lib/songs";

const MAX_IDS = 100;

// Optional auth, bulk: overall Track DNA score per track id, for the
// collapsed track-row summary. Only returns scores for ids the caller may
// access (owns it, or it's published) — never trusts the id list alone.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ scores: {} });
  }

  const token = (await cookies()).get("token")?.value;
  const payload = token ? verifyToken(token) : null;

  const accessibleIds = await getAccessibleTrackIds(ids, payload?.userId ?? null);
  const scoresMap = await getTrackDnaOverallScores(Array.from(accessibleIds));

  const scores: Record<string, number | null> = {};
  for (const [trackId, overall] of scoresMap) {
    scores[trackId] = overall;
  }

  return NextResponse.json({ scores });
}
