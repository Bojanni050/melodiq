import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateAndSaveCoverArt } from "@/lib/generate-cover";
import { logApi } from "@/lib/logger";
import {
  contentTypeForFormat,
  detectFormatFromContentType,
  detectFormatFromUrl,
} from "@/lib/audio-format";

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

  console.log("[webhook/minimax] received:", JSON.stringify(body));

  const taskId = body.task_id;
  const status = body.status;
  const files: any[] = body.files ?? [];
  const firstFile = files[0];
  const audioUrl = firstFile?.audio_url;

  if (!taskId) {
    return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
  }

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.jobId, taskId), eq(tracks.provider, "minimax")));

  if (result.length === 0) {
    console.error(`[webhook/minimax] track not found for taskId: ${taskId}`);
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];

  if (status === "finished") {
    if (!audioUrl) {
      await db.update(tracks).set({ status: "failed", error: "No audio URL in webhook" }).where(eq(tracks.id, track.id!));
      return NextResponse.json({ error: "No audio URL" }, { status: 400 });
    }
    try {
      const axios = (await import("axios")).default;
      const { uploadToS3 } = await import("@/lib/s3");
      const audioRes = await axios.get(audioUrl, { responseType: "arraybuffer" });
      const headerType = String(audioRes.headers?.["content-type"] || "");
      const format = /\.wav(\?|$)/i.test(audioUrl)
        ? detectFormatFromUrl(audioUrl)
        : detectFormatFromContentType(headerType || "audio/mpeg");
      const s3Key = `tracks/${track.id}/audio.${format}`;
      await uploadToS3(s3Key, Buffer.from(audioRes.data), contentTypeForFormat(format));
      await db.update(tracks).set({
        status: "done",
        s3Key,
        format,
        audioUrl: `/api/tracks/${track.id}/download`,
      }).where(eq(tracks.id, track.id!));

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
        provider: "minimax",
        endpoint: "/api/webhooks/minimax",
        request: JSON.stringify(body),
        response: JSON.stringify({ trackId: track.id }),
        statusCode: 200,
      });
      console.log(`[webhook/minimax] track ${track.id} done`);
      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("[webhook/minimax] S3 upload failed:", error.message);
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
