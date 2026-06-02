import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, workspaces } from "@/db/schema";
import { isLyricsTaskSubmission, parseLyrics } from "@/lib/parse-lyrics";
import { eq, and, inArray } from "drizzle-orm";
import { getPresignedUrl, deleteFromS3 } from "@/lib/s3";
import { getPoYoStatus, getPoYoStatusValue, getPoYoTimestampedLyrics } from "@/lib/providers/poyo";
import { getTempolorStatus } from "@/lib/providers/tempolor";
import { getMusicGptConversionById } from "@/lib/providers/musicgpt";
import { uploadToS3 } from "@/lib/s3";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { getOriginalPoYoTaskId, requestMissingWavConversion } from "@/lib/request-wav-conversion";
import {
  contentTypeForFormat,
  detectFormatFromContentType,
  detectFormatFromUrl,
} from "@/lib/audio-format";
import { extractAudioDuration } from "@/lib/audio-duration";
import { generateAndSaveCoverArt } from "@/lib/generate-cover";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";
import { ensureWorkspaceSchema } from "@/lib/workspaces";

const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPoYoErrorMessage(payload: unknown): string | null {
  if (!isJsonObject(payload)) return null;
  const direct = payload.error;
  if (typeof direct === "string" && direct.trim()) return direct;
  const data = payload.data;
  if (!isJsonObject(data)) return null;
  const nested = data.error;
  if (typeof nested === "string" && nested.trim()) return nested;
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
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
    // Self-healing: if the stored lyrics timestamps are actually just a task submission receipt
    if (track.status === "done" && track.lyricsTimestamps && isLyricsTaskSubmission(track.lyricsTimestamps)) {
      try {
        const parsed = JSON.parse(track.lyricsTimestamps);
        const taskId = parsed.task_id || parsed.taskId || parsed.data?.task_id;
        if (taskId) {
          console.log(`[GET tracks/[id]] self-healing task_id submission detected: ${taskId}`);
          const status = await getPoYoStatus(taskId);
          const statusValue = getPoYoStatusValue(status);
          if (statusValue === "completed" || statusValue === "finished") {
            const finalTimestamps = JSON.stringify(status);
            await db
              .update(tracks)
              .set({ lyricsTimestamps: finalTimestamps })
              .where(eq(tracks.id, track.id!));
            track.lyricsTimestamps = finalTimestamps;
            console.log(`[GET tracks/[id]] self-healed lyricsTimestamps for track ${track.id}`);
          }
        }
      } catch (err: any) {
        console.error(`[GET tracks/[id]] self-healing check failed for track ${track.id}:`, err?.message ?? err);
      }
    }

    // Self-healing: if a track is done, vocal, but has no actual timings, trigger get-timestamped-lyrics
    const hasTimings = track.lyricsTimestamps && !isLyricsTaskSubmission(track.lyricsTimestamps)
      ? parseLyrics(track.lyrics, track.lyricsTimestamps).some(l => l.startTime >= 0)
      : false;

    if (
      track.status === "done" &&
      track.provider === "poyo" &&
      !track.instrumental &&
      track.audioId &&
      track.jobId &&
      !hasTimings &&
      !isLyricsTaskSubmission(track.lyricsTimestamps) // avoid double submission if already in progress
    ) {
      try {
        const resolvedTaskId = getOriginalPoYoTaskId(track.jobId);
        console.log(`[GET tracks/[id]] self-healing: triggering missing timestamped lyrics task for track ${track.id}`);
        const submitRes: any = await getPoYoTimestampedLyrics(resolvedTaskId, track.audioId);
        const taskId = submitRes?.task_id || submitRes?.data?.task_id;
        
        if (taskId) {
          const serializedReceipt = JSON.stringify(submitRes);
          await db
            .update(tracks)
            .set({ lyricsTimestamps: serializedReceipt })
            .where(eq(tracks.id, track.id!));
          
          track.lyricsTimestamps = serializedReceipt;
          console.log(`[GET tracks/[id]] self-healing: successfully submitted lyrics task ${taskId} for track ${track.id}`);
        }
      } catch (err: any) {
        console.error(`[GET tracks/[id]] self-healing lyrics submit failed:`, err?.message ?? err);
      }
    }

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
      const sourceJobId = getOriginalPoYoTaskId(track.jobId);
      const status = await getPoYoStatus(sourceJobId);
      const statusValue = getPoYoStatusValue(status);

      if (statusValue === "completed" || statusValue === "finished") {
        const syncResult = await syncPoYoTaskResult(sourceJobId, status);
        const syncedTrackIds = [...syncResult.updatedTrackIds, ...syncResult.createdTrackIds];
        if (syncedTrackIds.length > 0) {
          const syncedTracks = await db
            .select()
            .from(tracks)
            .where(inArray(tracks.id, syncedTrackIds));

          await Promise.allSettled(
            syncedTracks.map((syncedTrack) => requestMissingWavConversion(syncedTrack))
          );
        }

        const refreshed = await db
          .select()
          .from(tracks)
          .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

        if (refreshed.length > 0) {
          return NextResponse.json(refreshed[0]);
        }
      }

      if (statusValue === "failed" || statusValue === "error") {
        const errorMessage = getPoYoErrorMessage(status) || "Generation failed";
        const updated = await db
          .update(tracks)
          .set({ status: "failed", error: errorMessage })
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

        await Promise.all([
          uploadToS3(s3Key, Buffer.from(mp3Res.data), contentTypeForFormat(format)),
          ...(hdRes && s3KeyHd
            ? [uploadToS3(s3KeyHd, Buffer.from(hdRes.data), contentTypeForFormat(formatHd!))]
            : []),
        ]);

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

  if (track.provider === "musicgpt" && track.conversionId) {
    try {
      const conversion = await getMusicGptConversionById(track.conversionId);

      if (conversion) {
        const status = (conversion.status ?? "").toUpperCase();
        const audioUrl =
          conversion.audio_url ??
          conversion.conversion_path_1 ??
          conversion.conversion_path ??
          null;

        if (status === "COMPLETED" && audioUrl) {
          const audioRes = await axios.get(audioUrl, {
            responseType: "arraybuffer",
            timeout: 60000,
          });

          const audioBuffer = Buffer.from(audioRes.data);
          const s3Key = `tracks/${track.id}/audio.mp3`;
          await uploadToS3(s3Key, audioBuffer, "audio/mpeg");

          const duration = await extractAudioDuration(audioBuffer);

          // Retrieve WAV and timestamps from conversion details
          const isTrack1 = track.conversionId === conversion.conversion_id_1;
          const isTrack2 = track.conversionId === conversion.conversion_id_2;

          const wavUrl = isTrack1
            ? conversion.conversion_path_wav_1
            : isTrack2
              ? conversion.conversion_path_wav_2
              : (conversion.conversion_path_wav_1 || conversion.conversion_path_wav_2);

          const rawTimestamps = isTrack1
            ? conversion.lyrics_timestamped_1
            : conversion.lyrics_timestamped_2 || conversion.lyrics_timestamped_1;

          let s3KeyHd: string | null = null;
          let formatHd: string | null = null;
          let audioUrlHd: string | null = null;
          let lyricsTimestamps: string | null = null;

          if (wavUrl) {
            try {
              console.log(`[tracks/[id]] downloading WAV audio for track ${track.id} from ${wavUrl}`);
              const wavRes = await axios.get(wavUrl, {
                responseType: "arraybuffer",
                timeout: 60000,
              });
              const wavBuffer = Buffer.from(wavRes.data);
              s3KeyHd = `tracks/${track.id}/audio_hd.wav`;
              await uploadToS3(s3KeyHd, wavBuffer, "audio/wav");
              formatHd = "wav";
              audioUrlHd = `/api/tracks/${track.id}/download?hd=true`;
            } catch (wavErr: any) {
              console.error(`[tracks/[id]] WAV S3 upload failed for track ${track.id}:`, wavErr?.message ?? wavErr);
            }
          }

          if (rawTimestamps) {
            try {
              lyricsTimestamps = typeof rawTimestamps === "string"
                ? rawTimestamps
                : JSON.stringify(rawTimestamps);
            } catch {}
          }

          const updated = await db
            .update(tracks)
            .set({
              status: "done",
              s3Key,
              format: "mp3",
              duration,
              audioUrl: `/api/tracks/${track.id}/download`,
              error: null,
              ...(s3KeyHd ? { s3KeyHd, formatHd, audioUrlHd } : {}),
              ...(lyricsTimestamps ? { lyricsTimestamps } : {}),
            })
            .where(eq(tracks.id, track.id!))
            .returning();

          if (!track.s3KeyCover) {
            generateAndSaveCoverArt({
              id: track.id,
              userId: track.userId,
              title: track.title,
              prompt: track.prompt,
              instrumental: track.instrumental,
              lyrics: track.lyrics,
            }).catch((error) => console.error("[tracks/[id]] cover art generation failed", error));
          }

          return NextResponse.json(updated[0]);
        }

        if (status === "FAILED" || status.includes("FAIL")) {
          const updated = await db
            .update(tracks)
            .set({
              status: "failed",
              error: conversion.status_msg || "Generation failed",
            })
            .where(eq(tracks.id, track.id!))
            .returning();
          return NextResponse.json(updated[0]);
        }
      }

      return NextResponse.json(track);
    } catch {
      return NextResponse.json(track);
    }
  }

  if (track.createdAt && track.provider !== "musicgpt") {
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

  return NextResponse.json(track);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
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

  try {
    const body: unknown = await request.json();
    if (!isJsonObject(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const title = body.title;
    const regenerateCoverArt = body.regenerateCoverArt;
    const workspaceId = body.workspaceId;

    if (title === undefined && regenerateCoverArt !== true && workspaceId === undefined) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    if (regenerateCoverArt === true) {
      const track = result[0];
      await generateAndSaveCoverArt(
        {
          id: track.id,
          userId: track.userId,
          title: track.title,
          prompt: track.prompt,
          instrumental: track.instrumental,
          lyrics: track.lyrics,
        },
        { forceNew: true }
      );

      const refreshed = await db
        .select()
        .from(tracks)
        .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

      return NextResponse.json(refreshed[0]);
    }

    const updates: Partial<typeof tracks.$inferInsert> = {};

    if (title !== undefined) {
      if (title === null) {
        updates.title = null;
      } else if (typeof title === "string") {
        const trimmed = title.trim();
        if (trimmed.length > 255) {
          return NextResponse.json({ error: "Title too long (max 255 characters)" }, { status: 400 });
        }
        updates.title = trimmed ? trimmed : null;
      } else {
        return NextResponse.json({ error: "Invalid title" }, { status: 400 });
      }
    }

    if (workspaceId !== undefined) {
      if (workspaceId === null) {
        updates.workspaceId = null;
      } else if (typeof workspaceId === "string" && workspaceId.trim()) {
        const targetWorkspace = await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(and(eq(workspaces.id, workspaceId.trim()), eq(workspaces.userId, userId)))
          .limit(1);

        if (!targetWorkspace[0]) {
          return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
        }

        updates.workspaceId = targetWorkspace[0].id;
      } else {
        return NextResponse.json({ error: "Invalid workspaceId" }, { status: 400 });
      }
    }

    if (regenerateCoverArt !== undefined && regenerateCoverArt !== true) {
      if (typeof regenerateCoverArt !== "boolean") {
        return NextResponse.json({ error: "Invalid regenerateCoverArt" }, { status: 400 });
      }
    }

    const updated = await db
      .update(tracks)
      .set(updates)
      .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update track" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
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
    if (track.s3KeyCover) {
      await deleteFromS3(track.s3KeyCover);
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
