import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";
import { transcodeToMp3 } from "@/lib/transcode";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import { getBestSourceForOggConversion, TrackAudioFields } from "@/lib/audio-format";

/**
 * Convert a track's audio to MP3 320kbps.
 *
 * - If an MP3 is already available (s3KeyMp3 or format='mp3'), nothing is
 *   transcoded or deleted; s3KeyMp3 is just normalized in the database.
 * - Otherwise the best source is resolved (WAV | FLAC best FM), ogg-only
 *   tracks use their ogg fallback, downloaded and transcoded to
 *   `tracks/{id}/audio.mp3` at 320kbps.
 * - Existing audio files are never deleted or overwritten: convert to send, never convert to delete.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];
  const audioFields: TrackAudioFields = track;

  // Already MP3? Just make sure s3KeyMp3 is filled in, nothing to transcode.
  const existingMp3Key =
    track.s3KeyMp3 || (track.format === "mp3" && track.s3Key ? track.s3Key : null);
  if (existingMp3Key) {
    if (!track.s3KeyMp3) {
      await db
        .update(tracks)
        .set({ s3KeyMp3: existingMp3Key, updatedAt: new Date() })
        .where(eq(tracks.id, track.id));
    }
    return NextResponse.json({
      success: true,
      trackId: track.id,
      alreadyMp3: true,
      s3KeyMp3: existingMp3Key,
    });
  }

  // Best available source: WAV > FLAC > MP3 > other non-ogg; ogg-only falls back to the ogg itself.
  const bestSource =
    getBestSourceForOggConversion(audioFields) ??
    (track.s3Key?.endsWith(".ogg") ? { s3Key: track.s3Key, format: "ogg" as const } : null);
  if (!bestSource?.s3Key) {
    return NextResponse.json({ error: "No audio file available for conversion" }, { status: 400 });
  }

  // Already an MP3 file under another key? Use it as-is, no re-encode.
  if (bestSource.format === "mp3") {
    await db
      .update(tracks)
      .set({ s3KeyMp3: bestSource.s3Key, updatedAt: new Date() })
      .where(eq(tracks.id, track.id));
    return NextResponse.json({
      success: true,
      trackId: track.id,
      alreadyMp3: true,
      s3KeyMp3: bestSource.s3Key,
    });
  }

  try {
    const sourceBuffer = await downloadFromS3(bestSource.s3Key);
    const mp3Buffer = await transcodeToMp3(sourceBuffer, 320);

    const s3KeyMp3 = `tracks/${track.id}/audio.mp3`;
    await uploadToS3(s3KeyMp3, mp3Buffer, "audio/mpeg");

    await db
      .update(tracks)
      .set({ s3KeyMp3, updatedAt: new Date() })
      .where(eq(tracks.id, track.id));

    return NextResponse.json({
      success: true,
      trackId: track.id,
      s3KeyMp3,
    });
  } catch (error: any) {
    console.error(`[convert-mp3] failed for track ${id}:`, error);
    return NextResponse.json(
      { error: error?.message || "Failed to convert track to MP3" },
      { status: 500 }
    );
  }
}
