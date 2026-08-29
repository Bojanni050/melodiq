import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { getAudioDna } from "@/lib/songs";

// Tiny, cacheable endpoint for the player's loudness-normalization gain
// stage — deliberately just the one number instead of the full track row,
// since it's fetched on every track change regardless of which page (or how
// many hops of Track-shape mapping) started playback.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [owned] = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, auth.userId)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const audioDna = await getAudioDna(id);

  return NextResponse.json(
    { loudness: audioDna?.loudness ?? null },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
