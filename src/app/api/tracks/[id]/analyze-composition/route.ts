import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { scoreCompositionQuality } from "@/lib/providers/llm";
import { downloadFromS3 } from "@/lib/s3";
import type { AudioDna } from "@/lib/songs";

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
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  if (track.status !== "done" || !track.s3Key) {
    return NextResponse.json({ error: "Track audio isn't available yet" }, { status: 400 });
  }

  try {
    const audioBuffer = await downloadFromS3(track.s3Key);
    const composition = await scoreCompositionQuality(audioBuffer, track.format || "mp3");

    if (!composition) {
      return NextResponse.json({ error: "Composition analysis failed" }, { status: 502 });
    }

    const existing: Partial<AudioDna> = track.audioDna ? JSON.parse(track.audioDna) : {};
    const audioDna: AudioDna = {
      tempo: existing.tempo ?? null,
      key: existing.key ?? null,
      energy: existing.energy ?? null,
      loudness: existing.loudness ?? null,
      atmosphereTags: existing.atmosphereTags ?? null,
      lyricsScore: existing.lyricsScore ?? null,
      lyricsNotes: existing.lyricsNotes ?? null,
      compositionScore: composition.score,
      compositionNotes: composition.notes,
      computedAt: new Date().toISOString(),
    };

    await db
      .update(tracks)
      .set({ audioDna: JSON.stringify(audioDna) })
      .where(eq(tracks.id, track.id!));

    return NextResponse.json({ audioDna });
  } catch (error: any) {
    console.error(`[analyze-composition] failed for track ${id}:`, error?.message ?? error);
    return NextResponse.json({ error: "Composition analysis failed" }, { status: 500 });
  }
}
