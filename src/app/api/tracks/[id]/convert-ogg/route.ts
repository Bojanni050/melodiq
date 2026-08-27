import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";
import { transcodeToOgg } from "@/lib/transcode";
import { ensureWorkspaceSchema } from "@/lib/workspaces";

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
  const sourceKey = track.s3KeyHd || track.s3Key || track.s3KeyMp3;
  if (!sourceKey) {
    return NextResponse.json({ error: "No audio file available for conversion" }, { status: 400 });
  }

  try {
    const sourceBuffer = await downloadFromS3(sourceKey);
    const oggBuffer = await transcodeToOgg(sourceBuffer);

    const s3KeyOgg = `tracks/${track.id}/audio.ogg`;
    await uploadToS3(s3KeyOgg, oggBuffer, "audio/ogg");

    await db
      .update(tracks)
      .set({
        s3KeyOgg,
        updatedAt: new Date(),
      })
      .where(eq(tracks.id, track.id));

    return NextResponse.json({
      success: true,
      trackId: track.id,
      s3KeyOgg,
    });
  } catch (error: any) {
    console.error(`[convert-ogg] failed for track ${id}:`, error);
    return NextResponse.json(
      { error: error?.message || "Failed to convert track to Ogg Vorbis" },
      { status: 500 }
    );
  }
}
