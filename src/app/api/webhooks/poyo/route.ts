import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logApi } from "@/lib/logger";
import { extractPoYoErrorMessage, getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { requestMissingWavConversion } from "@/lib/request-wav-conversion";
import { generateAndSaveCoverArtForBatch } from "@/lib/generate-cover";
import { sendPushNotification } from "@/lib/push";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type PoYoWebhookFile = { audio_url?: string; audio_id?: string | null };

function firstString(value: unknown[]): string | undefined {
  for (const item of value) {
    if (typeof item === "string" && item.trim()) return item;
  }
  return undefined;
}

function parsePoYoWebhookFile(value: unknown): PoYoWebhookFile | null {
  if (!isJsonObject(value)) return null;
  const audioUrl = typeof value.audio_url === "string" ? value.audio_url : undefined;
  const resolvedAudioId = firstString([
    value.audio_id,
    value.audioId,
    value.file_id,
    value.fileId,
    value.song_id,
    value.songId,
    value.id,
  ]);
  const audioId = resolvedAudioId ?? (value.audio_id === null ? null : undefined);
  return audioUrl || audioId ? { audio_url: audioUrl, audio_id: audioId } : null;
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[webhook/poyo] received:", JSON.stringify(body));

  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const taskId =
    (typeof body.task_id === "string" ? body.task_id : undefined) ??
    (isJsonObject(body.data) && typeof body.data.task_id === "string" ? body.data.task_id : undefined) ??
    (isJsonObject(body.input) && typeof body.input.task_id === "string" ? body.input.task_id : undefined);
  const status = getPoYoStatusValue(body);
  const filesRaw = Array.isArray(body.files) ? body.files : [];
  const files = filesRaw.map(parsePoYoWebhookFile).filter((file): file is PoYoWebhookFile => Boolean(file));

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
        const errorMessage = syncResult.error || "No audio URL in webhook";
        console.error(`[webhook/poyo] sync produced no variants for task ${taskId} (track ${track.id}): ${errorMessage}`);
        await db.update(tracks).set({ status: "failed", error: errorMessage }).where(eq(tracks.id, track.id!));
        await logApi({
          userId: track.userId,
          type: "webhook",
          provider: "poyo",
          endpoint: "/api/webhooks/poyo",
          request: JSON.stringify(body),
          response: JSON.stringify({ taskId, error: errorMessage }),
          statusCode: 400,
        });
        return NextResponse.json({ error: errorMessage }, { status: 400 });
      }

      // Match each file to its corresponding track and save audioId when provided.
      // WAV conversion is requested below from synced track records to avoid depending on one webhook field shape.
      const allSyncedIds = [...syncResult.updatedTrackIds, ...syncResult.createdTrackIds];
      if (allSyncedIds.length > 0) {
        const syncedTracks = await db
          .select()
          .from(tracks)
          .where(inArray(tracks.id, allSyncedIds));

        await Promise.allSettled(
          files.map(async (file, i) => {
            const trackId = syncResult.variantIndexToTrackId[i];
            if (!file.audio_id || !trackId) return;

            await db
              .update(tracks)
              .set({ audioId: file.audio_id })
              .where(eq(tracks.id, trackId));
          })
        );

        // Re-fetch after optional audioId updates so conversion requests see latest DB values.
        const refreshedSyncedTracks = await db
          .select()
          .from(tracks)
          .where(inArray(tracks.id, allSyncedIds));

        await Promise.allSettled(
          refreshedSyncedTracks.map((syncedTrack) =>
            requestMissingWavConversion({
              ...syncedTrack,
              jobId: syncedTrack.jobId ?? taskId,
            })
          )
        );

        // Fire cover art for all synced tracks as one batch
        if (refreshedSyncedTracks.length > 0) {
          generateAndSaveCoverArtForBatch({
            tracks: refreshedSyncedTracks.map((t) => ({
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
      sendPushNotification(track.userId, {
        title: "Track klaar",
        body: track.title ? `"${track.title}" is klaar met genereren.` : "Je track is klaar met genereren.",
        url: "/library",
      }).catch(() => {});
      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("[webhook/poyo] S3 upload failed:", error.message);
      await db.update(tracks).set({ status: "failed", error: `S3 upload failed: ${error.message}` }).where(eq(tracks.id, track.id!));
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  if (status === "failed" || status === "error") {
    const errorMessage = extractPoYoErrorMessage(body) || "Generation failed";
    console.error(`[webhook/poyo] PoYo reported failure for task ${taskId} (track ${track.id}): ${errorMessage}`);
    await db.update(tracks).set({
      status: "failed",
      error: errorMessage,
    }).where(eq(tracks.id, track.id!));
    await logApi({
      userId: track.userId,
      type: "webhook",
      provider: "poyo",
      endpoint: "/api/webhooks/poyo",
      request: JSON.stringify(body),
      response: JSON.stringify({ taskId, error: errorMessage }),
      statusCode: 200,
    });
    sendPushNotification(track.userId, {
      title: "Generatie mislukt",
      body: track.title ? `"${track.title}" kon niet worden gegenereerd.` : "Een track kon niet worden gegenereerd.",
      url: "/library",
    }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
