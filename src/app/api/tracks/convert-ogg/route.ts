import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and, isNull, ne, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { downloadFromS3, uploadToS3, deleteFromS3 } from "@/lib/s3";
import { transcodeToOgg } from "@/lib/transcode";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import { getBestSourceForOggConversion } from "@/lib/audio-format";

export const dynamic = "force-dynamic";

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
    const whereConditions = [
      eq(tracks.userId, userId),
      eq(tracks.status, "done"),
      isNull(tracks.s3KeyOgg),
      ne(tracks.format, "ogg"),
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
        message: "No tracks found needing Ogg Vorbis conversion",
        total: 0,
        converted: 0,
        results: [],
      });
    }

    const results: Array<{ trackId: string; success: boolean; s3KeyOgg?: string; deletedMp3?: boolean; error?: string }> = [];

    for (const track of candidateTracks) {
      const bestSource = getBestSourceForOggConversion(track);
      if (!bestSource || !bestSource.s3Key) {
        results.push({ trackId: track.id, success: false, error: "No audio source key found" });
        continue;
      }

      try {
        const sourceBuffer = await downloadFromS3(bestSource.s3Key);
        const oggBuffer = await transcodeToOgg(sourceBuffer);
        const s3KeyOgg = `tracks/${track.id}/audio.ogg`;

        await uploadToS3(s3KeyOgg, oggBuffer, "audio/ogg");

        // Check if MP3 version exists for this track and delete it after successful conversion
        const mp3KeyToDelete = track.s3KeyMp3 || (track.s3Key && (track.s3Key.endsWith(".mp3") || track.format === "mp3") ? track.s3Key : null);
        if (mp3KeyToDelete) {
          try {
            await deleteFromS3(mp3KeyToDelete);
            console.log(`[batch-convert-ogg] Deleted MP3 version ${mp3KeyToDelete} for track ${track.id}`);
          } catch (delErr: any) {
            console.error(`[batch-convert-ogg] Failed to delete MP3 for track ${track.id}:`, delErr?.message ?? delErr);
          }
        }

        const updates: Record<string, any> = {
          s3KeyOgg,
          s3KeyMp3: null,
          updatedAt: new Date(),
        };

        if (track.s3Key === mp3KeyToDelete || track.format === "mp3" || !track.s3Key) {
          updates.s3Key = s3KeyOgg;
          updates.format = "ogg";
        }

        await db
          .update(tracks)
          .set(updates)
          .where(eq(tracks.id, track.id));

        results.push({ trackId: track.id, success: true, s3KeyOgg, deletedMp3: !!mp3KeyToDelete });
      } catch (err: any) {
        console.error(`[batch-convert-ogg] failed for track ${track.id}:`, err?.message ?? err);
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
    console.error("[batch-convert-ogg] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process batch OGG conversion" },
      { status: 500 }
    );
  }
}
