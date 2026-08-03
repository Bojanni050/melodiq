import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { analyzeTrackDna } from "@/lib/track-dna-analysis";

// On-demand version of the "Composition" Track DNA signal — lets the user
// trigger it for a specific track regardless of the AUTO_ANALYZE_COMPOSITION
// setting, instead of only ever running automatically on new generations.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  const result = await db
    .select({ id: tracks.id, status: tracks.status, s3Key: tracks.s3Key })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  if (track.status !== "done" || !track.s3Key) {
    return NextResponse.json({ error: "Track audio isn't available yet" }, { status: 400 });
  }

  const audioDna = await analyzeTrackDna(id);
  if (!audioDna) {
    return NextResponse.json({ error: "Composition analysis failed" }, { status: 502 });
  }

  return NextResponse.json({ audioDna });
}
