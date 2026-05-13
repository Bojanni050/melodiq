import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/s3";
import { logApi } from "@/lib/logger";
import axios from "axios";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { job_id, status, audio_url, audio_url_hd } = body;

  const track = await prisma.track.findFirst({
    where: { jobId: job_id, provider: "poyo" },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  if (status === "completed") {
    try {
      const response = await axios.get(audio_url, { responseType: "arraybuffer" });
      const s3Key = `tracks/${track.id}/audio.mp3`;
      await uploadToS3(s3Key, Buffer.from(response.data));

      const updated = await prisma.track.update({
        where: { id: track.id },
        data: {
          status: "done",
          s3Key,
          audioUrl: `/api/tracks/${track.id}/download`,
        },
      });

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "poyo",
        endpoint: "/api/webhooks/poyo",
        request: JSON.stringify(body),
        response: JSON.stringify({ trackId: updated.id }),
        statusCode: 200,
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      await prisma.track.update({
        where: { id: track.id },
        data: { status: "failed", error: `S3 upload failed: ${error.message}` },
      });

      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  if (status === "failed") {
    await prisma.track.update({
      where: { id: track.id },
      data: { status: "failed", error: body.error || "Generation failed" },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
