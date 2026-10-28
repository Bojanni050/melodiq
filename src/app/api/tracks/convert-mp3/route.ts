import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and, isNull, ne, inArray, type SQL } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";
import { transcodeToMp3 } from "@/lib/transcode";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import { getBestSourceForOggConversion, TrackAudioFields } from "@/lib/audio-format";

export const dynamic = "force-dynamic";

/**
 * Batch-convert tracks to MP3 320kbps (convert-to-send, never convert-to-delete).
 *
 * Candidates: done tracks without s3KeyMp3. Tracks that are already MP3 under
 * another key (format='mp3') get s3KeyMp3 normalized without a re-encode;
 * everything lossless (WAV/FLAC) and ogg-only tracks are transcoded to
 * `tracks/{id}/audio.mp3` at 320kbps. Existing files are never deleted.
 */
export async function POST(request: NextRequest) {
  await ensureWorkspaceSchema();

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const requestedIds = Array.isArray(body?.trackIds)
    ? body.trackIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : undefined;
  const uploadedOnly = body?.uploadedOnly === true;

  try {
    const whereConditions: SQL[] = [
      eq(tracks.userId, userId),
      eq(tracks.status, "done"),
      isNull(tracks.s3KeyMp3),
      ne(tracks.format, "mp3"),
    ];

    if (requestedIds && requestedIds.length > 0) {
      whereConditions.push(inArray(tracks.id, requestedIds));
    } else if (uploadedOnly) {
      whereConditions.push(eq(tracks.provider, "upload"));
    }

    const candidateTracks = await db
      .select()
      .from(tracks)
      .where(and(...whereConditions));

    if (candidateTracks.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tracks found needing MP3 conversion",
        total: 0,
        converted: 0,
        results: [],
      });
    }

    const results: Array<{ trackId: string; success: boolean; s3KeyMp3?: string; alreadyMp3?: boolean; error?: string }> = [];

    for (const track of candidateTracks) {
      const audioFields: TrackAudioFields = track;
      const bestSource =
        getBestSourceForOggConversion(audioFields) ??
        (track.s3Key?.endsWith(".ogg") ? { s3Key: track.s3Key, format: "ogg" as const } : null);
      if (!bestSource?.s3Key) {
        results.push({ trackId: track.id, success: false, error: "No audio source key found" });
        continue;
      }

      try {
        if (bestSource.format === "mp3") {
          // MP3 under another key: normalize s3KeyMp3, no re-encode.
          await db
            .update(tracks)
            .set({ s3KeyMp3: bestSource.s3Key, updatedAt: new Date() })
            .where(eq(tracks.id, track.id));
          results.push({ trackId: track.id, success: true, alreadyMp3: true, s3KeyMp3: bestSource.s3Key });
          continue;
        }

        const sourceBuffer = await downloadFromS3(bestSource.s3Key);
        const mp3Buffer = await transcodeToMp3(sourceBuffer, 320);
        const s3KeyMp3 = `tracks/${track.id}/audio.mp3`;

        await uploadToS3(s3KeyMp3, mp3Buffer, "audio/mpeg");

        await db
          .update(tracks)
          .set({ s3KeyMp3, updatedAt: new Date() })
          .where(eq(tracks.id, track.id));

        results.push({ trackId: track.id, success: true, s3KeyMp3 });
      } catch (err: any) {
        console.error(`[batch-convert-mp3] failed for track ${track.id}:`, err?.message ?? err);
        results.push({ trackId: track.id, success: false, error: err?.message || "Transcode error" });
      }
    }

    const convertedCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      total: candidateTracks.length,
      converted: convertedCount,
      results,
    });
  } catch (error: any) {
    console.error("[batch-convert-mp3] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process batch MP3 conversion" },
      { status: 500 }
    );
  }
}
