import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { getPoYoStatus, getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";

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

  const generatingPoYoTracks = result
    .filter((track) => track.provider === "poyo" && track.status === "generating" && !!track.jobId)
    .slice(0, 5);

  if (generatingPoYoTracks.length > 0) {
    await Promise.allSettled(
      generatingPoYoTracks.map(async (track) => {
        try {
          const statusPayload = await getPoYoStatus(track.jobId!);
          const statusValue = getPoYoStatusValue(statusPayload);
          if (statusValue === "completed" || statusValue === "finished") {
            await syncPoYoTaskResult(track.jobId!, statusPayload);
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
    if (track.status === "generating" && track.createdAt) {
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
