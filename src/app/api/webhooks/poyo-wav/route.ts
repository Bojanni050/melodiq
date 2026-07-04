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
import { getOriginalPoYoTaskId } from "@/lib/request-wav-conversion";
import { getPoYoTimestampedLyrics, getPoYoStatus, getPoYoStatusValue } from "@/lib/providers/poyo";
import { convertWavToFlac } from "@/lib/wav-to-flac";

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
    await logApi({
      type: "webhook",
      provider: "poyo",
      endpoint: "/api/webhooks/poyo-wav",
      request: JSON.stringify(body),
      response: JSON.stringify({ error: "Track not found", taskId, audioId }),
      statusCode: 404,
    });
    return NextResponse.json({ success: true });
  }

  const byWavJobId = taskId ? result.find((item) => item.wavJobId === String(taskId)) : undefined;
  const byAudioId = audioId ? result.find((item) => item.audioId === String(audioId)) : undefined;
  const byJobId = taskId ? result.find((item) => item.jobId === String(taskId)) : undefined;

  const track = byWavJobId || byAudioId || byJobId || result[0];
  const matchedBy = byWavJobId
    ? "wavJobId"
    : byAudioId
      ? "audioId"
      : byJobId
        ? "jobId"
        : "fallback-first";

  if (!audioUrl) {
    await db
      .update(tracks)
      .set({ status: "failed", error: "No WAV audio URL in webhook" })
      .where(eq(tracks.id, track.id!));
    await logApi({
      userId: track.userId,
      type: "webhook",
      provider: "poyo",
      endpoint: "/api/webhooks/poyo-wav",
      request: JSON.stringify(body),
      response: JSON.stringify({ error: "No WAV audio URL in webhook", trackId: track.id, matchedBy }),
      statusCode: 400,
    });
    return NextResponse.json({ error: "No audio URL" }, { status: 400 });
  }

  try {
    const axios = (await import("axios")).default;
    const { uploadToS3 } = await import("@/lib/s3");

    const audioRes = await axios.get(audioUrl, { responseType: "arraybuffer" });
    const audioBuffer = Buffer.from(audioRes.data);
    const headerType = String(audioRes.headers?.["content-type"] || "");
    let formatHd = detectFormatFromUrl(audioUrl) === "wav"
      ? "wav"
      : detectFormatFromContentType(headerType || "audio/wav");

    let uploadBuffer = audioBuffer;
    if (formatHd === "wav") {
      const flacBuffer = await convertWavToFlac(audioBuffer);
      if (flacBuffer) {
        uploadBuffer = flacBuffer;
        formatHd = "flac";
      }
      // If ffmpeg unavailable, uploadBuffer/formatHd stay as WAV — upload as-is
    }

    const s3KeyHd = track.s3KeyHd ?? `tracks/${track.id}/audio_hd.${formatHd}`;
    await uploadToS3(s3KeyHd, uploadBuffer, contentTypeForFormat(formatHd));

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
      response: JSON.stringify({
        trackId: track.id,
        audioId: audioId ?? track.audioId,
        formatHd,
        matchedBy,
      }),
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
      }).catch((error) => console.error("[webhook/poyo-wav] cover art generation failed", error));
    }

    const resolvedAudioId = audioId ? String(audioId) : track.audioId;
    const resolvedTaskId = track.jobId ? getOriginalPoYoTaskId(track.jobId) : null;
    const shouldFetchTimestampedLyrics =
      !track.instrumental &&
      resolvedAudioId !== null &&
      resolvedTaskId !== null &&
      !track.lyricsTimestamps;

    if (shouldFetchTimestampedLyrics) {
      void (async () => {
        try {
          console.log(`[webhook/poyo-wav] submitting timestamped lyrics task for track ${track.id}`);
          const submitRes: any = await getPoYoTimestampedLyrics(resolvedTaskId, resolvedAudioId);
          const taskId = submitRes?.task_id || submitRes?.data?.task_id;
          
          if (!taskId) {
            console.error(`[webhook/poyo-wav] no task_id returned from getPoYoTimestampedLyrics submit for track ${track.id}`);
            return;
          }

          // Save the task submission first so we know a task was started
          await db
            .update(tracks)
            .set({ lyricsTimestamps: JSON.stringify(submitRes) })
            .where(eq(tracks.id, track.id!));

          // Poll for completion in the background
          let completed = false;
          let attempts = 0;
          const maxAttempts = 30; // 30 attempts * 2s = 60s max

          while (!completed && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            attempts++;

            const statusData = await getPoYoStatus(taskId);
            const statusValue = getPoYoStatusValue(statusData);

            console.log(`[webhook/poyo-wav] polling lyrics status (attempt ${attempts}): ${statusValue}`);

            if (statusValue === "completed" || statusValue === "finished") {
              await db
                .update(tracks)
                .set({ lyricsTimestamps: JSON.stringify(statusData) })
                .where(eq(tracks.id, track.id!));
              completed = true;
              console.log(`[webhook/poyo-wav] successfully retrieved and saved timestamped lyrics for track ${track.id}`);
            } else if (statusValue === "failed" || statusValue === "error") {
              console.error(`[webhook/poyo-wav] get-timestamped-lyrics task failed for track ${track.id}`);
              completed = true;
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[webhook/poyo-wav] timestamped lyrics polling failed:", message);
        }
      })();
    }

    console.log(
      `[webhook/poyo-wav] track ${track.id} WAV synced (matchedBy=${matchedBy}, taskId=${taskId ?? "(none)"}, audioId=${audioId ?? "(none)"})`
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[webhook/poyo-wav] S3 upload failed:", error.message);
    await db
      .update(tracks)
      .set({ status: "failed", error: `S3 upload failed: ${error.message}` })
      .where(eq(tracks.id, track.id!));
    await logApi({
      userId: track.userId,
      type: "webhook",
      provider: "poyo",
      endpoint: "/api/webhooks/poyo-wav",
      request: JSON.stringify(body),
      response: JSON.stringify({ error: error.message, trackId: track.id, matchedBy }),
      statusCode: 500,
    });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
