import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyToken } from "@/lib/auth";
import { getAudioDna, getTrackDnaAccess } from "@/lib/songs";

// Public counterpart of /api/tracks/[id]/loudness for the player's
// loudness-normalization gain stage, used when playing a track via a public
// Discover source (see mediaBase() in playerUtils.tsx).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const token = (await cookies()).get("token")?.value;
  const payload = token ? verifyToken(token) : null;

  const track = await getTrackDnaAccess(trackId, payload?.userId ?? null);
  if (!track) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const audioDna = await getAudioDna(trackId);

  return NextResponse.json(
    { loudness: audioDna?.loudness ?? null },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
