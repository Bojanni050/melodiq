import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logApi } from "@/lib/logger";
import { getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { requestMissingWavConversion } from "@/lib/request-wav-conversion";
import { generateAndSaveCoverArtForBatch } from "@/lib/generate-cover";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[webhook/poyo] received:", JSON.stringify(body));

  const taskId = body.task_id;
  const status = getPoYoStatusValue(body);
  const files = Array.isArray(body.files)
    ? (body.files as Array<{ audio_url?: string; audio_id?: string | null }>)
    : [];

  if (!taskId) {
    return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
  }

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.jobId, taskId), eq(tracks.provider, "poyo")));

  if (result.length === 0) {
    console.error(`[webhook/poyo] track not found for taskId: ${taskId}`);
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];

  if (status === "finished" || status === "completed") {
    try {
      const syncResult = await syncPoYoTaskResult(taskId, body);

      if (syncResult.variantCount === 0) {
        await db.update(tracks).set({ status: "failed", error: syncResult.error || "No audio URL in webhook" }).where(eq(tracks.id, track.id!));
        return NextResponse.json({ error: syncResult.error || "No audio URL" }, { status: 400 });
      }

      // Match each file to its corresponding track and save audioId + request WAV conversion
      const allSyncedIds = [...syncResult.updatedTrackIds, ...syncResult.createdTrackIds];
      if (allSyncedIds.length > 0) {
        const syncedTracks = await db
          .select()
          .from(tracks)
          .where(inArray(tracks.id, allSyncedIds));

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const trackId = syncResult.variantIndexToTrackId[i];
          if (!file.audio_id || !trackId) continue;

          await db
            .update(tracks)
            .set({ audioId: file.audio_id })
            .where(eq(tracks.id, trackId));

          const trackForFile = syncedTracks.find((t) => t.id === trackId);
          if (trackForFile) {
            await requestMissingWavConversion({
              ...trackForFile,
              jobId: taskId,
              audioId: file.audio_id,
            });
          }
        }

        // Fire cover art for all synced tracks as one batch
        if (syncedTracks.length > 0) {
          generateAndSaveCoverArtForBatch({
            tracks: syncedTracks.map((t) => ({
              id: t.id!,
              userId: t.userId,
              prompt: t.prompt,
              title: t.title ?? null,
              instrumental: t.instrumental,
            })),
          }).catch((error) => console.error("[webhook/poyo] cover art batch failed", error));
        }
      }

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "poyo",
        endpoint: "/api/webhooks/poyo",
        request: JSON.stringify(body),
        response: JSON.stringify({
          taskId,
          variantCount: syncResult.variantCount,
          updatedTrackIds: syncResult.updatedTrackIds,
          createdTrackIds: syncResult.createdTrackIds,
        }),
        statusCode: 200,
      });
      console.log(`[webhook/poyo] task ${taskId} synced (${syncResult.variantCount} variants)`);
      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("[webhook/poyo] S3 upload failed:", error.message);
      await db.update(tracks).set({ status: "failed", error: `S3 upload failed: ${error.message}` }).where(eq(tracks.id, track.id!));
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  if (status === "failed" || status === "error") {
    await db.update(tracks).set({
      status: "failed",
      error: body.error_message || "Generation failed",
    }).where(eq(tracks.id, track.id!));
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
