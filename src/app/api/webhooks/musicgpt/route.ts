import { NextRequest } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateAndSaveCoverArt } from "@/lib/generate-cover";
import { logApi } from "@/lib/logger";
import { extractAudioDuration } from "@/lib/audio-duration";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  console.log("[webhook/musicgpt] received:", JSON.stringify(body));

  // MusicGPT webhook payload fields (from official docs):
  // task_id       — shared across both tracks of a generation
  // conversion_id — unique per track variant (matches conversion_id_1 / conversion_id_2 from generate response)
  // status        — "COMPLETED" | "FAILED"
  // audio_url     — direct S3 URL to the mp3
  // conversion_type — "Music AI" | "Lyrics" | "Image" etc — skip non-audio payloads
  const taskId: string | undefined =
    body.task_id ?? body.taskId ?? undefined;
  const conversionId: string | undefined =
    body.conversion_id ??
    body.conversionId ??
    body.conversion_id_1 ??
    undefined;
  const conversionType: string | undefined =
    body.conversion_type ??
    body.conversionType ??
    body.feature ??
    undefined;
  const status: string =
    ((body.status ?? body.status_msg ?? body.message ?? "") as string).toUpperCase();
  const audioUrl: string | undefined =
    body.audio_url ??
    body.audioUrl ??
    body.conversion_path ??
    body.conversion_path_1 ??
    body.conversion_path_2 ??
    undefined;

  if (!taskId) {
    console.error("[webhook/musicgpt] missing task_id in payload");
    return new Response("missing task_id", { status: 400 });
  }

  // MusicGPT sends multiple webhooks per generation:
  // - 2x Music conversion (one per variant) — these have audio_url
  // - 2x Lyrics with timestamps — no audio_url, conversion_type contains "Lyrics"
  // - 1x Album cover image — no audio_url, conversion_type contains "Image"
  // Skip non-audio webhooks early to avoid unnecessary DB lookups.
  if (conversionType) {
    const type = conversionType.toUpperCase();
    if (
      !type.includes("MUSIC") &&
      !type.includes("AUDIO") &&
      (type.includes("LYRIC") || type.includes("IMAGE") || type.includes("COVER") || type.includes("ALBUM"))
    ) {
      console.log(`[webhook/musicgpt] skipping non-audio webhook (type=${conversionType})`);
      return new Response("success", { status: 200 });
    }
  }

  // Look up all tracks sharing this task_id (always 2 for MusicGPT Music AI)
  const result = await db
    .select()
    .from(tracks)
    .where(eq(tracks.jobId, taskId));

  if (result.length === 0) {
    console.error(`[webhook/musicgpt] no track found for task_id: ${taskId}`);
    // Return 200 so MusicGPT doesn't keep retrying for unknown tasks
    return new Response("success", { status: 200 });
  }

  // Select the correct track variant using conversion_id.
  // conversion_id_1 / conversion_id_2 from the generate response are stored
  // in the tracks table as conversionId for track 1 and track 2 respectively.
  // Without this, result[0] would always update the same track and track 2
  // would remain stuck on "generating" indefinitely.
  const track = conversionId
    ? (result.find((t) => t.conversionId === conversionId) ?? result[0])
    : result[0];

  const matchedBy = conversionId
    ? (result.find((t) => t.conversionId === conversionId) ? "conversionId" : "jobId-fallback")
    : "jobId-only";

  console.log(
    `[webhook/musicgpt] matched track ${track.id} via ${matchedBy} ` +
    `(conversionId=${conversionId ?? "none"}, taskId=${taskId})`
  );

  if (status === "COMPLETED" && audioUrl) {
    try {
      const axios = (await import("axios")).default;
      const { uploadToS3 } = await import("@/lib/s3");

      console.log(`[webhook/musicgpt] downloading audio from ${audioUrl}`);
      const audioRes = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
      });
      const audioBuffer = Buffer.from(audioRes.data);
      const s3Key = `tracks/${track.id}/audio.mp3`;
      await uploadToS3(s3Key, audioBuffer);

      const duration = await extractAudioDuration(audioBuffer);

      await db
        .update(tracks)
        .set({
          status: "done",
          s3Key,
          duration,
          audioUrl: `/api/tracks/${track.id}/download`,
        })
        .where(eq(tracks.id, track.id!));

      // Fire-and-forget cover art — only generate if not already present
      if (!track.s3KeyCover) {
        generateAndSaveCoverArt({
          id: track.id,
          userId: track.userId,
          title: track.title,
          prompt: track.prompt,
          instrumental: track.instrumental,
        }).catch(() => {});
      }

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "musicgpt",
        endpoint: "/api/webhooks/musicgpt",
        request: JSON.stringify(body),
        response: JSON.stringify({ trackId: track.id, matchedBy, conversionId }),
        statusCode: 200,
      });

      console.log(`[webhook/musicgpt] track ${track.id} done (matchedBy=${matchedBy})`);
      return new Response("success", { status: 200 });
    } catch (error: any) {
      console.error("[webhook/musicgpt] failed:", error.message);
      await db
        .update(tracks)
        .set({ status: "failed", error: `Processing failed: ${error.message}` })
        .where(eq(tracks.id, track.id!));
      return new Response("success", { status: 200 });
    }
  }

  if (status === "FAILED" || status.includes("FAIL")) {
    await db
      .update(tracks)
      .set({ status: "failed", error: body.status_msg || "Generation failed" })
      .where(eq(tracks.id, track.id!));

    await logApi({
      userId: track.userId,
      type: "webhook",
      provider: "musicgpt",
      endpoint: "/api/webhooks/musicgpt",
      request: JSON.stringify(body),
      response: JSON.stringify({ trackId: track.id, status: "failed" }),
      statusCode: 200,
    });

    return new Response("success", { status: 200 });
  }

  // Still processing — just acknowledge
  console.log(`[webhook/musicgpt] task ${taskId} status=${status}, waiting...`);
  return new Response("success", { status: 200 });
}