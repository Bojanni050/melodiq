import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq, isNull, isNotNull, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { requestWavConversion } from "@/lib/request-wav-conversion";
import { retryStaleApimartWavConversions } from "@/lib/apimart-wav";

/**
 * POST /api/tracks/retry-wav
 *
 * Vraagt WAV/HD conversie opnieuw aan voor tracks die succesvol zijn
 * gegenereerd (status = 'done') maar nog geen HD-bestand hebben:
 * - PoYo: vraagt direct een nieuwe WAV-conversie aan bij PoYo.
 * - APIMart: reset de auto-retry cooldown/teller (die na 8 mislukte pogingen
 *   permanent stopt) en laat het self-healing proces daarna direct opnieuw
 *   proberen, in plaats van te wachten op de volgende Library-poll.
 *
 * Optioneel: { trackId } in de body beperkt de retry tot die ene track
 * (gebruikt door de "Retry WAV" actie in het track-actiemenu) — zonder
 * trackId worden alle in aanmerking komende tracks van de user geretried.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const trackId = typeof body?.trackId === "string" ? body.trackId : undefined;

  try {
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
          isNull(tracks.s3KeyHd),
          trackId ? eq(tracks.id, trackId) : undefined
        )
      );

    const results: { trackId: string; success: boolean; wavJobId?: string }[] = [];

    for (const track of tracksToRetry) {
      try {
        const wavTaskId = await requestWavConversion({
          id: track.id!,
          jobId: track.jobId!,
          audioId: track.audioId!,
          userId: track.userId,
        });

        if (wavTaskId) {
          // Save the new WAV job ID and reset the auto-retry budget so the
          // self-healing loop gets a fresh cooldown/attempt count if this one fails too.
          await db
            .update(tracks)
            .set({ wavJobId: wavTaskId, wavRetryAt: null, wavRetryCount: 0 })
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

    const apimartTracksToRetry = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(
        and(
          eq(tracks.userId, userId),
          eq(tracks.provider, "apimart"),
          eq(tracks.status, "done"),
          isNotNull(tracks.jobId),
          isNull(tracks.s3KeyHd),
          trackId ? eq(tracks.id, trackId) : undefined
        )
      );

    if (apimartTracksToRetry.length > 0) {
      // Manual retry bypasses the auto-heal cooldown/attempt cap entirely —
      // otherwise a track that already exhausted its 8 auto-retries would
      // stay permanently stuck with no way to force another attempt.
      await db
        .update(tracks)
        .set({ wavJobId: null, wavRetryAt: null, wavRetryCount: 0 })
        .where(inArray(tracks.id, apimartTracksToRetry.map((t) => t.id!)));

      await retryStaleApimartWavConversions(userId, trackId);
      for (const track of apimartTracksToRetry) {
        results.push({ trackId: track.id!, success: true });
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tracks need WAV retry",
        retried: 0,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const totalCount = tracksToRetry.length + apimartTracksToRetry.length;

    return NextResponse.json({
      success: true,
      message: `Retried WAV/HD conversion for ${successCount}/${totalCount} tracks`,
      retried: successCount,
      total: totalCount,
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
