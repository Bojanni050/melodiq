import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/s3";
import { getPoYoStatus } from "@/lib/providers/poyo";
import { getTempolorStatus } from "@/lib/providers/tempolor";
import { uploadToS3 } from "@/lib/s3";
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

      if (status.status === "completed") {
        const response = await axios.get(status.audio_url, { responseType: "arraybuffer" });
        const s3Key = `tracks/${track.id}/audio.mp3`;
        await uploadToS3(s3Key, Buffer.from(response.data));

        const updated = await db
          .update(tracks)
          .set({
            status: "done",
            s3Key,
            audioUrl: `/api/tracks/${track.id}/download`,
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

        const updated = await db
          .update(tracks)
          .set({
            status: "done",
            s3Key,
            s3KeyHd,
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
