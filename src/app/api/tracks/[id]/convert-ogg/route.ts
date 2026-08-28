import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { downloadFromS3, uploadToS3, deleteFromS3 } from "@/lib/s3";
import { transcodeToOgg } from "@/lib/transcode";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import { getBestSourceForOggConversion } from "@/lib/audio-format";

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
  const bestSource = getBestSourceForOggConversion(track);
  if (!bestSource || !bestSource.s3Key) {
    return NextResponse.json({ error: "No audio file available for conversion" }, { status: 400 });
  }

  try {
    const sourceBuffer = await downloadFromS3(bestSource.s3Key);
    const oggBuffer = await transcodeToOgg(sourceBuffer);

    const s3KeyOgg = `tracks/${track.id}/audio.ogg`;
    await uploadToS3(s3KeyOgg, oggBuffer, "audio/ogg");

    // Check if MP3 version exists for this track and delete it after successful OGG conversion
    const mp3KeyToDelete = track.s3KeyMp3 || (track.s3Key && (track.s3Key.endsWith(".mp3") || track.format === "mp3") ? track.s3Key : null);
    if (mp3KeyToDelete) {
      try {
        await deleteFromS3(mp3KeyToDelete);
        console.log(`[convert-ogg] Deleted MP3 version ${mp3KeyToDelete} for track ${track.id}`);
      } catch (delErr: any) {
        console.error(`[convert-ogg] Failed to delete MP3 for track ${track.id}:`, delErr?.message ?? delErr);
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

    return NextResponse.json({
      success: true,
      trackId: track.id,
      s3KeyOgg,
      deletedMp3: !!mp3KeyToDelete,
    });
  } catch (error: any) {
    console.error(`[convert-ogg] failed for track ${id}:`, error);
    return NextResponse.json(
      { error: error?.message || "Failed to convert track to Ogg Vorbis" },
      { status: 500 }
    );
  }
}
