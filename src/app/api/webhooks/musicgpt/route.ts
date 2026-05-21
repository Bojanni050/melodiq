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
  // task_id, status ("COMPLETED" | "FAILED"), audio_url, title, conversion_cost
  const taskId: string | undefined =
    body.task_id ?? body.taskId ?? undefined;
  const status: string | undefined =
    (body.status ?? body.status_msg ?? "").toUpperCase();
  const audioUrl: string | undefined =
    body.audio_url ?? body.audioUrl ?? body.conversion_path ?? undefined;

  if (!taskId) {
    console.error("[webhook/musicgpt] missing task_id in payload");
    return new Response("missing task_id", { status: 400 });
  }

  const result = await db
    .select()
    .from(tracks)
    .where(eq(tracks.jobId, taskId));

  if (result.length === 0) {
    console.error(`[webhook/musicgpt] no track found for task_id: ${taskId}`);
    // Return 200 so MusicGPT doesn't keep retrying for unknown tasks
    return new Response("success", { status: 200 });
  }

  const track = result[0];

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

      generateAndSaveCoverArt({
        id: track.id,
        userId: track.userId,
        title: track.title,
        prompt: track.prompt,
        instrumental: track.instrumental,
      }).catch(() => {});

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "musicgpt",
        endpoint: "/api/webhooks/musicgpt",
        request: JSON.stringify(body),
        response: JSON.stringify({ trackId: track.id }),
        statusCode: 200,
      });

      console.log(`[webhook/musicgpt] track ${track.id} done`);
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

  if (status === "FAILED" || (status && status.includes("FAIL"))) {
    await db
      .update(tracks)
      .set({ status: "failed", error: body.status_msg || "Generation failed" })
      .where(eq(tracks.id, track.id!));
    return new Response("success", { status: 200 });
  }

  // Still processing — just acknowledge
  console.log(`[webhook/musicgpt] task ${taskId} status=${status}, waiting...`);
  return new Response("success", { status: 200 });
}
