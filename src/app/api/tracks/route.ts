import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { getPoYoStatus, getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { getOriginalPoYoTaskId, requestMissingWavConversion } from "@/lib/request-wav-conversion";

const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(tracks)
    .where(eq(tracks.userId, userId))
    .orderBy(desc(tracks.createdAt));

  const generatingPoYoTracks = Array.from(
    new Map(
      result
        .filter((track) => track.provider === "poyo" && track.status === "generating" && !!track.jobId)
        .map((track) => [getOriginalPoYoTaskId(track.jobId!), track])
    ).values()
  ).slice(0, 5);

  if (generatingPoYoTracks.length > 0) {
    await Promise.allSettled(
      generatingPoYoTracks.map(async (track) => {
        try {
          const sourceJobId = getOriginalPoYoTaskId(track.jobId!);
          const statusPayload = await getPoYoStatus(sourceJobId);
          const statusValue = getPoYoStatusValue(statusPayload);
          if (statusValue === "completed" || statusValue === "finished") {
            const syncResult = await syncPoYoTaskResult(sourceJobId, statusPayload);
            const syncedTrackIds = [...syncResult.updatedTrackIds, ...syncResult.createdTrackIds];
            if (syncedTrackIds.length > 0) {
              const syncedTracks = await db
                .select()
                .from(tracks)
                .where(inArray(tracks.id, syncedTrackIds));

              await Promise.allSettled(
                syncedTracks.map((syncedTrack) => requestMissingWavConversion(syncedTrack))
              );
            }
          }
        } catch {
          // Best-effort fallback polling for missed webhooks.
        }
      })
    );
  }

  const refreshedResult = await db
    .select()
    .from(tracks)
    .where(eq(tracks.userId, userId))
    .orderBy(desc(tracks.createdAt));

  const now = Date.now();
  const timedOutIds: string[] = [];

  for (const track of refreshedResult) {
    if (track.status === "generating" && track.createdAt && track.provider !== "musicgpt") {
      const elapsed = now - new Date(track.createdAt).getTime();
      if (elapsed > GENERATION_TIMEOUT_MS) {
        timedOutIds.push(track.id!);
      }
    }
  }

  if (timedOutIds.length > 0) {
    await db
      .update(tracks)
      .set({ status: "failed", error: "Generation timed out. Please try again." })
      .where(inArray(tracks.id, timedOutIds));

    const refreshed = await db
      .select()
      .from(tracks)
      .where(eq(tracks.userId, userId))
      .orderBy(desc(tracks.createdAt));

    return NextResponse.json({ tracks: refreshed });
  }

  return NextResponse.json({ tracks: refreshedResult });
}
