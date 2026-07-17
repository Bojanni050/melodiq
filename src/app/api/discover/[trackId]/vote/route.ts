import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/require-auth";
import { getTrackDnaAccess, getTrackDnaStats, upsertTrackDnaVote } from "@/lib/songs";

function parseScore(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 10) / 10;
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}

// Requires auth: casts or updates the caller's vote for one track. Re-verifies
// the caller can access this track (owns it, or it's published) before
// accepting a vote — never trusts the client-supplied instrumental flag
// either, it's re-read from the track row.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const track = await getTrackDnaAccess(trackId, auth.userId);
  if (!track) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  if (track.pollsCloseAt && track.pollsCloseAt <= new Date()) {
    return NextResponse.json({ error: "Voting is closed for this track." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const vocal = parseScore(body?.vocal);
  const instrumental = parseScore(body?.instrumental);
  const atmosphere = parseScore(body?.atmosphere);
  const lyrics = track.instrumental ? null : parseScore(body?.lyrics);

  if (vocal === null || instrumental === null || atmosphere === null || (!track.instrumental && lyrics === null)) {
    return NextResponse.json({ error: "Each category must be a number from 1.0 to 10.0" }, { status: 400 });
  }

  await upsertTrackDnaVote(trackId, auth.userId, { vocal, instrumental, atmosphere, lyrics });
  const stats = await getTrackDnaStats(trackId);

  return NextResponse.json({ stats });
}
