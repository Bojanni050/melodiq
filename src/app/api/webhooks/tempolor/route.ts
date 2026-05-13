import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/s3";
import { logApi } from "@/lib/logger";
import axios from "axios";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { job_id, status, audio_url, audio_url_hd } = body;

  const track = await prisma.track.findFirst({
    where: { jobId: job_id, provider: "tempolor" },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  if (status === "completed") {
    try {
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

      const updated = await prisma.track.update({
        where: { id: track.id },
        data: {
          status: "done",
          s3Key,
          s3KeyHd,
          audioUrl: `/api/tracks/${track.id}/download`,
          audioUrlHd: s3KeyHd ? `/api/tracks/${track.id}/download?hd=true` : null,
        },
      });

      await logApi({
        userId: track.userId,
        type: "webhook",
        provider: "tempolor",
        endpoint: "/api/webhooks/tempolor",
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
