import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/require-auth";
import { getPublishedTrackById, getTrackDnaStats, upsertTrackDnaVote } from "@/lib/songs";

function parseScore(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10) return null;
  return n;
}

// Requires auth: casts or updates the caller's vote for one track. Re-verifies
// the track is still published before accepting a vote — never trusts the
// client-supplied instrumental flag either, it's re-read from the track row.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const track = await getPublishedTrackById(trackId);
  if (!track) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const vocal = parseScore(body?.vocal);
  const instrumental = parseScore(body?.instrumental);
  const atmosphere = parseScore(body?.atmosphere);
  const lyrics = track.instrumental ? null : parseScore(body?.lyrics);

  if (vocal === null || instrumental === null || atmosphere === null || (!track.instrumental && lyrics === null)) {
    return NextResponse.json({ error: "Each category must be a whole number from 1 to 10" }, { status: 400 });
  }

  await upsertTrackDnaVote(trackId, auth.userId, { vocal, instrumental, atmosphere, lyrics });
  const stats = await getTrackDnaStats(trackId);

  return NextResponse.json({ stats });
}
