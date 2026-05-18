import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedUrl, deleteFromS3 } from "@/lib/s3";
import { getPoYoStatus } from "@/lib/providers/poyo";
import { getTempolorStatus } from "@/lib/providers/tempolor";
import { uploadToS3 } from "@/lib/s3";
import { getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import {
  contentTypeForFormat,
  detectFormatFromContentType,
  detectFormatFromUrl,
} from "@/lib/audio-format";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";

const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];

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

  if (track.createdAt) {
    const elapsed = Date.now() - new Date(track.createdAt).getTime();
    if (elapsed > GENERATION_TIMEOUT_MS) {
      const updated = await db
        .update(tracks)
        .set({ status: "failed", error: "Generation timed out. Please try again." })
        .where(eq(tracks.id, track.id!))
        .returning();
      return NextResponse.json(updated[0]);
    }
  }

  if (track.provider === "poyo" && track.jobId) {
    try {
      const status = await getPoYoStatus(track.jobId);
      const statusValue = getPoYoStatusValue(status);

      if (statusValue === "completed" || statusValue === "finished") {
        await syncPoYoTaskResult(track.jobId, status);
        const refreshed = await db
          .select()
          .from(tracks)
          .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

        if (refreshed.length > 0) {
          return NextResponse.json(refreshed[0]);
        }
      }

      if (statusValue === "failed" || statusValue === "error") {
        const updated = await db
          .update(tracks)
          .set({ status: "failed", error: status.error || status?.data?.error || "Generation failed" })
          .where(eq(tracks.id, track.id!))
          .returning();
        return NextResponse.json(updated[0]);
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

        const primaryHeaderType = String(mp3Res.headers?.["content-type"] || "");
        const format = /\.wav(\?|$)/i.test(status.audio_url)
          ? detectFormatFromUrl(status.audio_url)
          : detectFormatFromContentType(primaryHeaderType || "audio/mpeg");
        const formatHd = status.audio_url_hd
          ? detectFormatFromUrl(status.audio_url_hd)
          : null;

        const s3Key = `tracks/${track.id}/audio.${format}`;
        const s3KeyHd = status.audio_url_hd && formatHd
          ? `tracks/${track.id}/audio_hd.${formatHd}`
          : null;

        await uploadToS3(s3Key, Buffer.from(mp3Res.data), contentTypeForFormat(format));
        if (hdRes && s3KeyHd) {
          await uploadToS3(s3KeyHd, Buffer.from(hdRes.data), contentTypeForFormat(formatHd!));
        }

        const updated = await db
          .update(tracks)
          .set({
            status: "done",
            s3Key,
            s3KeyHd,
            format,
            formatHd,
            audioUrl: `/api/tracks/${track.id}/download`,
            audioUrlHd: s3KeyHd ? `/api/tracks/${track.id}/download?hd=true` : null,
          })
          .where(eq(tracks.id, track.id!))
          .returning();

        return NextResponse.json(updated[0]);
      }

      if (status.status === "failed") {
        const updated = await db
          .update(tracks)
          .set({ status: "failed", error: status.error || "Generation failed" })
          .where(eq(tracks.id, track.id!))
          .returning();
        return NextResponse.json(updated[0]);
      }

      return NextResponse.json(track);
    } catch {
      return NextResponse.json(track);
    }
  }

  return NextResponse.json(track);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  if (result.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = result[0];

  try {
    if (track.s3Key) {
      await deleteFromS3(track.s3Key);
    }
    if (track.s3KeyHd) {
      await deleteFromS3(track.s3KeyHd);
    }

    await db
      .delete(tracks)
      .where(eq(tracks.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete track" }, { status: 500 });
  }
}
