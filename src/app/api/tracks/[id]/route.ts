import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateLyria } from "@/lib/providers/lyria";
import { getPoYoStatus } from "@/lib/providers/poyo";
import { getTempolorStatus } from "@/lib/providers/tempolor";
import { uploadToS3, getPresignedUrl } from "@/lib/s3";
import axios from "axios";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");

  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const track = await prisma.track.findFirst({
    where: { id, userId: decoded.userId },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  if (track.status === "done" || track.status === "failed") {
    let audioUrl = track.audioUrl;
    let audioUrlHd = track.audioUrlHd;

    if (track.s3Key) {
      audioUrl = await getPresignedUrl(track.s3Key);
    }
    if (track.s3KeyHd) {
      audioUrlHd = await getPresignedUrl(track.s3KeyHd);
    }

    return NextResponse.json({
      ...track,
      audioUrl,
      audioUrlHd,
    });
  }

  if (track.provider === "poyo" && track.jobId) {
    try {
      const status = await getPoYoStatus(track.jobId);

      if (status.status === "completed") {
        const response = await axios.get(status.audio_url, { responseType: "arraybuffer" });
        const s3Key = `tracks/${track.id}/audio.mp3`;
        await uploadToS3(s3Key, Buffer.from(response.data));

        const updated = await prisma.track.update({
          where: { id: track.id },
          data: {
            status: "done",
            s3Key,
            audioUrl: await getPresignedUrl(s3Key),
          },
        });

        return NextResponse.json(updated);
      }

      if (status.status === "failed") {
        const updated = await prisma.track.update({
          where: { id: track.id },
          data: { status: "failed", error: status.error || "Generation failed" },
        });
        return NextResponse.json(updated);
      }

      return NextResponse.json(track);
    } catch {
      return NextResponse.json(track);
    }
  }

  if (track.provider === "tempolor" && track.jobId) {
    try {
      const status = await getTempolorStatus(track.jobId);

      if (status.status === "completed") {
        const [mp3Res, hdRes] = await Promise.all([
          axios.get(status.audio_url, { responseType: "arraybuffer" }),
          status.audio_url_hd
            ? axios.get(status.audio_url_hd, { responseType: "arraybuffer" })
            : null,
        ]);

        const s3Key = `tracks/${track.id}/audio.mp3`;
        const s3KeyHd = status.audio_url_hd
          ? `tracks/${track.id}/audio_hd.mp3`
          : null;

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
            audioUrl: await getPresignedUrl(s3Key),
            audioUrlHd: s3KeyHd ? await getPresignedUrl(s3KeyHd) : null,
          },
        });

        return NextResponse.json(updated);
      }

      if (status.status === "failed") {
        const updated = await prisma.track.update({
          where: { id: track.id },
          data: { status: "failed", error: status.error || "Generation failed" },
        });
        return NextResponse.json(updated);
      }

      return NextResponse.json(track);
    } catch {
      return NextResponse.json(track);
    }
  }

  return NextResponse.json(track);
}
