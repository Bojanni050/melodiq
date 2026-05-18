import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logApi } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { job_id, status, audio_url } = body;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.jobId, job_id), eq(tracks.provider, "poyo")));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];

  if (status === "completed") {
    try {
      const axios = await import("axios");
      const { uploadToS3 } = await import("@/lib/s3");

      const response = await axios.default.get(audio_url, { responseType: "arraybuffer" });
      const s3Key = `tracks/${track.id}/audio.mp3`;
      await uploadToS3(s3Key, Buffer.from(response.data));

      await db
        .update(tracks)
        .set({
          status: "done",
          s3Key,
          audioUrl: `/api/tracks/${track.id}/download`,
        })
        .where(eq(tracks.id, track.id!));

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "poyo",
        endpoint: "/api/webhooks/poyo",
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
