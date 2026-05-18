import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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
    return new Response("forbidden", { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  console.log("[webhook/tempolor] received:", JSON.stringify(body));

  const songs: any[] = body.songs ?? [];
  const song = songs[0];

  if (!song?.item_id) {
    return new Response("missing item_id", { status: 400 });
  }

  const itemId = song.item_id;
  const status = song.status;
  const audioUrl = song.audio_url;
  const audioUrlHd = song.audio_hi_url ?? null;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.jobId, itemId), eq(tracks.provider, "tempolor")));

  if (result.length === 0) {
    console.error(`[webhook/tempolor] track not found for itemId: ${itemId}`);
    return new Response("success", { status: 200 });
  }

  const track = result[0];

  if (status === "succeeded") {
    if (!audioUrl) {
      await db.update(tracks).set({ status: "failed", error: "No audio URL" }).where(eq(tracks.id, track.id!));
      return new Response("success", { status: 200 });
    }
    try {
      const axios = (await import("axios")).default;
      const { uploadToS3 } = await import("@/lib/s3");

      const [mp3Res, hdRes] = await Promise.all([
        axios.get(audioUrl, { responseType: "arraybuffer" }),
        audioUrlHd ? axios.get(audioUrlHd, { responseType: "arraybuffer" }) : null,
      ]);

      const mp3ContentType = String(mp3Res.headers?.["content-type"] || "");
      const format = /\.wav(\?|$)/i.test(audioUrl)
        ? detectFormatFromUrl(audioUrl)
        : detectFormatFromContentType(mp3ContentType || "audio/mpeg");
      const formatHd = audioUrlHd ? detectFormatFromUrl(audioUrlHd) : null;

      const s3Key = `tracks/${track.id}/audio.${format}`;
      const s3KeyHd = audioUrlHd && formatHd ? `tracks/${track.id}/audio_hd.${formatHd}` : null;

      await uploadToS3(s3Key, Buffer.from(mp3Res.data), contentTypeForFormat(format));
      if (hdRes && s3KeyHd && formatHd) {
        await uploadToS3(s3KeyHd, Buffer.from(hdRes.data), contentTypeForFormat(formatHd));
      }

      await db.update(tracks).set({
        status: "done",
        s3Key,
        s3KeyHd,
        format,
        formatHd,
        audioUrl: `/api/tracks/${track.id}/download`,
        audioUrlHd: s3KeyHd ? `/api/tracks/${track.id}/download?hd=true` : null,
      }).where(eq(tracks.id, track.id!));

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "tempolor",
        endpoint: "/api/webhooks/tempolor",
        request: JSON.stringify(body),
        response: JSON.stringify({ trackId: track.id }),
        statusCode: 200,
      });

      console.log(`[webhook/tempolor] track ${track.id} done`);
      return new Response("success", { status: 200 });
    } catch (error: any) {
      console.error("[webhook/tempolor] S3 upload failed:", error.message);
      await db.update(tracks).set({ status: "failed", error: `S3 upload failed: ${error.message}` }).where(eq(tracks.id, track.id!));
      return new Response("success", { status: 200 });
    }
  }

  if (status === "failed") {
    await db.update(tracks).set({ status: "failed", error: "Generation failed" }).where(eq(tracks.id, track.id!));
    return new Response("success", { status: 200 });
  }

  return new Response("success", { status: 200 });
}
