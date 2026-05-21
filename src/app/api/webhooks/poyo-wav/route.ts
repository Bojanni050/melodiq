import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { logApi } from "@/lib/logger";
import {
  contentTypeForFormat,
  detectFormatFromContentType,
  detectFormatFromUrl,
} from "@/lib/audio-format";
import { extractAudioDuration } from "@/lib/audio-duration";
import { generateAndSaveCoverArt } from "@/lib/generate-cover";

function pickAudioUrl(body: any): string | null {
  const files: any[] = body?.files ?? body?.data?.files ?? [];
  const firstFile = files[0] ?? {};

  return (
    firstFile.wav_url ||
    firstFile.audio_url_hd ||
    firstFile.audio_url ||
    body?.wav_url ||
    body?.audio_url_hd ||
    body?.audio_url ||
    body?.data?.wav_url ||
    body?.data?.audio_url_hd ||
    body?.data?.audio_url ||
    null
  );
}

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

  console.log("[webhook/poyo-wav] received:", JSON.stringify(body));

  const taskId = body.task_id ?? body?.data?.task_id ?? body?.input?.task_id ?? null;
  const audioId = body.audio_id ?? body?.data?.audio_id ?? body?.input?.audio_id ?? null;
  const audioUrl = pickAudioUrl(body);

  if (!taskId && !audioId) {
    return NextResponse.json({ error: "Missing task_id or audio_id" }, { status: 400 });
  }

  const result = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.provider, "poyo"),
        or(
          taskId ? eq(tracks.jobId, taskId) : undefined,
          taskId ? eq(tracks.wavJobId, taskId) : undefined,
          audioId ? eq(tracks.audioId, String(audioId)) : undefined
        )
      )
    );

  if (result.length === 0) {
    console.error(
      `[webhook/poyo-wav] track not found for taskId: ${taskId ?? "(none)"} audioId: ${audioId ?? "(none)"}`
    );
    return NextResponse.json({ success: true });
  }

  const track =
    (taskId ? result.find((item) => item.wavJobId === String(taskId)) : undefined) ||
    (audioId ? result.find((item) => item.audioId === String(audioId)) : undefined) ||
    (taskId ? result.find((item) => item.jobId === String(taskId)) : undefined) ||
    result[0];

  if (!audioUrl) {
    await db
      .update(tracks)
      .set({ status: "failed", error: "No WAV audio URL in webhook" })
      .where(eq(tracks.id, track.id!));
    return NextResponse.json({ error: "No audio URL" }, { status: 400 });
  }

  try {
    const axios = (await import("axios")).default;
    const { uploadToS3 } = await import("@/lib/s3");

    const audioRes = await axios.get(audioUrl, { responseType: "arraybuffer" });
    const audioBuffer = Buffer.from(audioRes.data);
    const headerType = String(audioRes.headers?.["content-type"] || "");
    const formatHd = detectFormatFromUrl(audioUrl) === "wav"
      ? "wav"
      : detectFormatFromContentType(headerType || "audio/wav");

    const s3KeyHd = `tracks/${track.id}/audio_hd.${formatHd}`;
    await uploadToS3(s3KeyHd, audioBuffer, contentTypeForFormat(formatHd));

    // Extract duration if not already set
    let duration = track.duration;
    if (!duration) {
      duration = await extractAudioDuration(audioBuffer);
    }

    await db
      .update(tracks)
      .set({
        status: "done",
        audioId: audioId ? String(audioId) : track.audioId,
        s3KeyHd,
        formatHd,
        duration,
        audioUrlHd: `/api/tracks/${track.id}/download?hd=true`,
      })
      .where(eq(tracks.id, track.id!));

    await logApi({
      userId: track.userId,
      type: "webhook",
      provider: "poyo",
      endpoint: "/api/webhooks/poyo-wav",
      request: JSON.stringify(body),
      response: JSON.stringify({ trackId: track.id, audioId: audioId ?? track.audioId, formatHd }),
      statusCode: 200,
    });

    // Fire cover art only if not already set (fallback for when Pixazo was down at generate time)
    if (!track.s3KeyCover) {
      generateAndSaveCoverArt({
        id: track.id!,
        userId: track.userId,
        title: track.title ?? null,
        prompt: track.prompt,
        instrumental: track.instrumental,
      }).catch(() => {});
    }

    console.log(`[webhook/poyo-wav] track ${track.id} WAV synced`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[webhook/poyo-wav] S3 upload failed:", error.message);
    await db
      .update(tracks)
      .set({ status: "failed", error: `S3 upload failed: ${error.message}` })
      .where(eq(tracks.id, track.id!));
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}