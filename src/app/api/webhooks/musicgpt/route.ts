import { NextRequest, NextResponse } from "next/server";
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

  const taskId = body.task_id;
  const conversionId = body.conversion_id;
  const success = body.success;
  const conversionPath = body.conversion_path;

  if (!taskId || !conversionId) {
    return new Response("missing task_id or conversion_id", { status: 400 });
  }

  const result = await db
    .select()
    .from(tracks)
    .where(eq(tracks.jobId, taskId));

  if (result.length === 0) {
    console.error(`[webhook/musicgpt] track not found for taskId: ${taskId}`);
    return new Response("success", { status: 200 });
  }

  const track = result[0];

  if (success && conversionPath) {
    if (!conversionPath) {
      await db
        .update(tracks)
        .set({ status: "failed", error: "No audio URL in webhook" })
        .where(eq(tracks.id, track.id!));
      return new Response("success", { status: 200 });
    }

    try {
      const axios = (await import("axios")).default;
      const { uploadToS3 } = await import("@/lib/s3");

      const audioRes = await axios.get(conversionPath, { responseType: "arraybuffer" });
      const audioBuffer = Buffer.from(audioRes.data);
      const s3Key = `tracks/${track.id}/audio.mp3`;
      await uploadToS3(s3Key, audioBuffer);

      // Extract duration
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
      console.error("[webhook/musicgpt] S3 upload failed:", error.message);
      await db
        .update(tracks)
        .set({ status: "failed", error: `S3 upload failed: ${error.message}` })
        .where(eq(tracks.id, track.id!));
      return new Response("success", { status: 200 });
    }
  }

  if (!success) {
    await db
      .update(tracks)
      .set({ status: "failed", error: body.reason || "Generation failed" })
      .where(eq(tracks.id, track.id!));
    return new Response("success", { status: 200 });
  }

  return new Response("success", { status: 200 });
}
