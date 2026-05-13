import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logApi } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { job_id, status, audio_url, audio_url_hd } = body;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.jobId, job_id), eq(tracks.provider, "tempolor")));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];

  if (status === "completed") {
    try {
      const axios = (await import("axios")).default;
      const { uploadToS3 } = await import("@/lib/s3");

      const [mp3Res, hdRes] = await Promise.all([
        axios.get(audio_url, { responseType: "arraybuffer" }),
        audio_url_hd ? axios.get(audio_url_hd, { responseType: "arraybuffer" }) : null,
      ]);

      const s3Key = `tracks/${track.id}/audio.mp3`;
      const s3KeyHd = audio_url_hd ? `tracks/${track.id}/audio_hd.mp3` : null;

      await uploadToS3(s3Key, Buffer.from(mp3Res.data));
      if (hdRes && s3KeyHd) {
        await uploadToS3(s3KeyHd, Buffer.from(hdRes.data));
      }

      await db
        .update(tracks)
        .set({
          status: "done",
          s3Key,
          s3KeyHd,
          audioUrl: `/api/tracks/${track.id}/download`,
          audioUrlHd: s3KeyHd ? `/api/tracks/${track.id}/download?hd=true` : null,
        })
        .where(eq(tracks.id, track.id!));

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "tempolor",
        endpoint: "/api/webhooks/tempolor",
        request: JSON.stringify(body),
        response: JSON.stringify({ trackId: track.id }),
        statusCode: 200,
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      await db
        .update(tracks)
        .set({ status: "failed", error: `S3 upload failed: ${error.message}` })
        .where(eq(tracks.id, track.id!));

      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  if (status === "failed") {
    await db
      .update(tracks)
      .set({ status: "failed", error: body.error || "Generation failed" })
      .where(eq(tracks.id, track.id!));

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
