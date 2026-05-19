import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logApi } from "@/lib/logger";
import { getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { requestWavConversion } from "@/lib/request-wav-conversion";
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
  const firstFile = files[0];
  const audioUrl = firstFile?.audio_url;
  const audioId = firstFile?.audio_id ?? null;

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

      if (audioId) {
        await db
          .update(tracks)
          .set({
            audioId,
          })
          .where(eq(tracks.id, track.id!));
      }

      // Vraag meteen WAV conversie aan - PoYo bewaart bestanden maar 3 dagen.
      if (audioId && track.jobId) {
        requestWavConversion({
          id: track.id!,
          jobId: track.jobId,
          audioId,
        }).catch(() => {});
      }

      const syncedIds = syncResult.updatedTrackIds;
      if (syncedIds.length > 0) {
        const syncedTracks = await db
          .select()
          .from(tracks)
          .where(inArray(tracks.id, syncedIds));

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
          }).catch(() => {});
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
