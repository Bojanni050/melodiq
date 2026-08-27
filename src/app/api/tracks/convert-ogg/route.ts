import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and, isNull, ne, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";
import { transcodeToOgg } from "@/lib/transcode";
import { ensureWorkspaceSchema } from "@/lib/workspaces";

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

    const results: Array<{ trackId: string; success: boolean; s3KeyOgg?: string; error?: string }> = [];

    for (const track of candidateTracks) {
      const sourceKey = track.s3KeyHd || track.s3Key || track.s3KeyMp3;
      if (!sourceKey) {
        results.push({ trackId: track.id, success: false, error: "No audio source key found" });
        continue;
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

        results.push({ trackId: track.id, success: true, s3KeyOgg });
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
