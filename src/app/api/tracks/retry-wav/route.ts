import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { requestWavConversion } from "@/lib/request-wav-conversion";

/**
 * POST /api/tracks/retry-wav
 * 
 * Vraagt WAV conversie opnieuw aan voor tracks die:
 * - status = 'done'
 * - provider = 'poyo'
 * - audioId IS NOT NULL (hebben een audioId)
 * - s3KeyHd IS NULL (hebben nog geen WAV)
 * - jobId IS NOT NULL (nodig voor conversie)
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    // Find tracks without WAV that have audioId
    const tracksToRetry = await db
      .select()
      .from(tracks)
      .where(
        and(
          eq(tracks.userId, userId),
          eq(tracks.provider, "poyo"),
          eq(tracks.status, "done"),
          isNotNull(tracks.audioId),
          isNotNull(tracks.jobId),
          isNull(tracks.s3KeyHd)
        )
      );

    if (tracksToRetry.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tracks need WAV retry",
        retried: 0,
      });
    }

    const results: { trackId: string; success: boolean; wavJobId?: string }[] = [];

    for (const track of tracksToRetry) {
      try {
        const wavTaskId = await requestWavConversion({
          id: track.id!,
          jobId: track.jobId!,
          audioId: track.audioId!,
        });

        if (wavTaskId) {
          // Save the new WAV job ID
          await db
            .update(tracks)
            .set({ wavJobId: wavTaskId })
            .where(eq(tracks.id, track.id!));

          results.push({ trackId: track.id!, success: true, wavJobId: wavTaskId });
        } else {
          results.push({ trackId: track.id!, success: false });
        }
      } catch (error) {
        console.error(`[retry-wav] Failed for track ${track.id}:`, error);
        results.push({ trackId: track.id!, success: false });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Retried WAV conversion for ${successCount}/${tracksToRetry.length} tracks`,
      retried: successCount,
      total: tracksToRetry.length,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[retry-wav] Error:", message);
    return NextResponse.json(
      { error: "Failed to retry WAV conversion", details: message },
      { status: 500 }
    );
  }
}
