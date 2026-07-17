import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, workspaces, songs } from "@/db/schema";
import { RELEASE_STATUSES, type ReleaseStatus } from "@/lib/release-status";
import { isLyricsTaskSubmission, parseLyrics } from "@/lib/parse-lyrics";
import { eq, and, inArray } from "drizzle-orm";
import { getPresignedUrl, deleteFromS3 } from "@/lib/s3";
import { extractPoYoErrorMessage, getPoYoStatus, getPoYoStatusValue, getPoYoTimestampedLyrics } from "@/lib/providers/poyo";
import { getTempolorStatus } from "@/lib/providers/tempolor";
import { getApiframeStatus } from "@/lib/providers/apiframe";
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
import { detectAndSaveLanguageIfMissing } from "@/lib/language-detect";
import { detectLanguageFromLyrics } from "@/lib/providers/llm";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";
import { ensureDefaultWorkspaceForUser, ensureWorkspaceSchema } from "@/lib/workspaces";

const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_WORKSPACE_SENTINEL = "workspace-default";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function extractAudioUrls(body: any): string[] {
  if (!body || typeof body !== "object") return [];
  const urls: string[] = [];

  const tracksList = body.result?.tracks || body.tracks;
  if (Array.isArray(tracksList)) {
    for (const t of tracksList) {
      if (t?.audioUrl) urls.push(t.audioUrl);
      else if (t?.url) urls.push(t.url);
      else if (t?.audio_url) urls.push(t.audio_url);
    }
  }

  const songs = body.result?.songs || body.songs;
  if (Array.isArray(songs)) {
    for (const s of songs) {
      if (s?.audioUrl) urls.push(s.audioUrl);
      else if (s?.audio_url) urls.push(s.audio_url);
      else if (s?.url) urls.push(s.url);
    }
  }

  if (urls.length === 0) {
    const scan = (val: any) => {
      if (typeof val === "string") {
        if (val.startsWith("http") && (val.includes(".mp3") || val.includes(".wav") || val.includes("/audio/"))) {
          urls.push(val);
        }
      } else if (Array.isArray(val)) {
        val.forEach(scan);
      } else if (typeof val === "object" && val !== null) {
        Object.values(val).forEach(scan);
      }
    };
    scan(body);
  }

  return urls;
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
        const errorMessage = extractPoYoErrorMessage(status) || "Generation failed";
        console.error(`[tracks/[id]] PoYo generation failed for task ${sourceJobId} (track ${track.id}): ${errorMessage}`);
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

        if (!track.language) {
          detectAndSaveLanguageIfMissing({
            id: track.id!,
            language: track.language,
            lyrics: track.lyrics,
            instrumental: track.instrumental,
          }).catch((error) => console.error("[tracks/[id]] language detection failed (tempolor)", error));
        }

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

  if (track.provider === "apiframe" && track.jobId) {
    try {
      const parentJobId = track.jobId.split(":")[0];
      const status = await getApiframeStatus(parentJobId);
      const statusStr = (status.status || "").toLowerCase();

      if (statusStr === "completed" || statusStr === "succeeded" || statusStr === "done" || statusStr === "finished") {
        const outputs = extractAudioUrls(status);
        const isSecond = track.jobId.endsWith(":1");
        const audioUrl = isSecond ? outputs[1] : outputs[0];

        if (audioUrl) {
          const mp3Res = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60000 });
          const mp3Buffer = Buffer.from(mp3Res.data);
          const format = "mp3";
          const s3Key = `tracks/${track.id}/audio.${format}`;
          const duration = await extractAudioDuration(mp3Buffer);

          await uploadToS3(s3Key, mp3Buffer, "audio/mpeg");

          const updated = await db
            .update(tracks)
            .set({
              status: "done",
              s3Key,
              format,
              duration,
              audioUrl: `/api/tracks/${track.id}/download`,
            })
            .where(eq(tracks.id, track.id!))
            .returning();

          if (!track.language) {
            detectAndSaveLanguageIfMissing({
              id: track.id!,
              language: track.language,
              lyrics: track.lyrics,
              instrumental: track.instrumental,
            }).catch((error) => console.error("[tracks/[id]] language detection failed (apiframe)", error));
          }

          return NextResponse.json(updated[0]);
        }
      }

      if (statusStr === "failed" || statusStr === "error") {
        const updated = await db
          .update(tracks)
          .set({ status: "failed", error: status.error || "Generation failed" })
          .where(eq(tracks.id, track.id!))
          .returning();
        return NextResponse.json(updated[0]);
      }

      return NextResponse.json(track);
    } catch (e: any) {
      console.error(`[tracks/[id]] active polling failed for APIFrame track ${track.id}:`, e?.message ?? e);
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

          if (!track.language) {
            detectAndSaveLanguageIfMissing({
              id: track.id!,
              language: track.language,
              lyrics: track.lyrics,
              instrumental: track.instrumental,
            }).catch((error) => console.error("[tracks/[id]] language detection failed (musicgpt)", error));
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
    const prompt = body.prompt;
    const lyrics = body.lyrics;
    const regenerateCoverArt = body.regenerateCoverArt;
    const workspaceId = body.workspaceId;
    const songId = body.songId;
    const artistName = body.artistName;
    const composerName = body.composerName;
    const instrumental = body.instrumental;
    const language = body.language;
    const provider = body.provider;
    const duration = body.duration;
    const restore = body.restore;
    const sunoStyleInfluence = body.sunoStyleInfluence;
    const sunoWeirdness = body.sunoWeirdness;
    const detectLanguage = body.detectLanguage;
    const releaseStatus = body.releaseStatus;
    const publishDate = body.publishDate;
    const trackDna = body.trackDna;
    const pollsOpenAt = body.pollsOpenAt;
    const pollsCloseAt = body.pollsCloseAt;

    if (restore === true) {
      await db.update(tracks).set({ deletedAt: null }).where(eq(tracks.id, id));
      return NextResponse.json({ success: true });
    }

    if (title === undefined && prompt === undefined && lyrics === undefined && regenerateCoverArt !== true && workspaceId === undefined && songId === undefined && artistName === undefined && composerName === undefined && instrumental === undefined && language === undefined && provider === undefined && duration === undefined && sunoStyleInfluence === undefined && sunoWeirdness === undefined && detectLanguage !== true && releaseStatus === undefined && publishDate === undefined && trackDna === undefined && pollsOpenAt === undefined && pollsCloseAt === undefined) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    if (regenerateCoverArt === true) {
      const track = result[0];
      // Fire-and-forget — don't await so the request returns before Vercel timeout
      generateAndSaveCoverArt(
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
      return NextResponse.json({ accepted: true, requestedAt: Date.now() }, { status: 202 });
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

    if (prompt !== undefined) {
      if (typeof prompt !== "string") {
        return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
      }

      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
      }
      if (trimmedPrompt.length > 10000) {
        return NextResponse.json({ error: "Prompt too long (max 10000 characters)" }, { status: 400 });
      }

      updates.prompt = trimmedPrompt;
    }

    if (lyrics !== undefined) {
      if (lyrics === null) {
        updates.lyrics = null;
        updates.lyricsTimestamps = null;
      } else if (typeof lyrics === "string") {
        const trimmedLyrics = lyrics.trim();
        if (trimmedLyrics.length > 20000) {
          return NextResponse.json({ error: "Lyrics too long (max 20000 characters)" }, { status: 400 });
        }
        updates.lyrics = trimmedLyrics ? trimmedLyrics : null;
        updates.lyricsTimestamps = null;
      } else {
        return NextResponse.json({ error: "Invalid lyrics" }, { status: 400 });
      }
    }

    if (artistName !== undefined) {
      if (artistName === null) {
        updates.artistName = null;
      } else if (typeof artistName === "string") {
        const trimmed = artistName.trim();
        if (trimmed.length > 255) {
          return NextResponse.json({ error: "Artist name too long (max 255 characters)" }, { status: 400 });
        }
        updates.artistName = trimmed || null;
      } else {
        return NextResponse.json({ error: "Invalid artistName" }, { status: 400 });
      }
    }

    if (composerName !== undefined) {
      if (composerName === null) {
        updates.composerName = null;
      } else if (typeof composerName === "string") {
        const trimmed = composerName.trim();
        if (trimmed.length > 255) {
          return NextResponse.json({ error: "Composer name too long (max 255 characters)" }, { status: 400 });
        }
        updates.composerName = trimmed || null;
      } else {
        return NextResponse.json({ error: "Invalid composerName" }, { status: 400 });
      }
    }

    if (instrumental !== undefined) {
      if (typeof instrumental !== "boolean") {
        return NextResponse.json({ error: "Invalid instrumental value" }, { status: 400 });
      }
      updates.instrumental = instrumental;
    }

    if (language !== undefined) {
      if (language === null) {
        updates.language = null;
      } else if (typeof language === "string") {
        const trimmed = language.trim();
        updates.language = trimmed || null;
      } else {
        return NextResponse.json({ error: "Invalid language" }, { status: 400 });
      }
    }

    if (detectLanguage === true) {
      const track = result[0];
      if (!track.language && !track.instrumental && track.lyrics?.trim()) {
        try {
          const detected = await detectLanguageFromLyrics(track.lyrics);
          if (detected) {
            updates.language = detected;
          }
        } catch (error) {
          console.error(`[tracks/[id]] language detection failed for track ${track.id}:`, error);
        }
      }
    } else if (detectLanguage !== undefined && typeof detectLanguage !== "boolean") {
      return NextResponse.json({ error: "Invalid detectLanguage" }, { status: 400 });
    }

    if (duration !== undefined) {
      if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
        updates.duration = Math.round(duration);
      } else if (duration !== null) {
        return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
      }
    }

    if (provider !== undefined) {
      if (typeof provider !== "string" || !provider.trim()) {
        return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
      }
      updates.provider = provider.trim();
    }

    if (workspaceId !== undefined) {
      if (workspaceId === null) {
        updates.workspaceId = null;
      } else if (typeof workspaceId === "string" && workspaceId.trim()) {
        const normalizedWorkspaceId = workspaceId.trim();

        if (normalizedWorkspaceId === DEFAULT_WORKSPACE_SENTINEL) {
          const defaultWorkspace = await ensureDefaultWorkspaceForUser(userId);
          updates.workspaceId = defaultWorkspace.id;
        } else if (!isUuid(normalizedWorkspaceId)) {
          return NextResponse.json({ error: "Invalid workspaceId" }, { status: 400 });
        } else {
        const targetWorkspace = await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(and(eq(workspaces.id, normalizedWorkspaceId), eq(workspaces.userId, userId)))
          .limit(1);

        if (!targetWorkspace[0]) {
          return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
        }

        updates.workspaceId = targetWorkspace[0].id;
        }
      } else {
        return NextResponse.json({ error: "Invalid workspaceId" }, { status: 400 });
      }
    }

    if (songId !== undefined) {
      if (songId === null) {
        updates.songId = null;
      } else if (typeof songId === "string" && songId.trim() && isUuid(songId.trim())) {
        const normalizedSongId = songId.trim();

        const targetSong = await db
          .select({ id: songs.id, workspaceId: songs.workspaceId })
          .from(songs)
          .where(and(eq(songs.id, normalizedSongId), eq(songs.userId, userId)))
          .limit(1);

        if (!targetSong[0]) {
          return NextResponse.json({ error: "Song not found" }, { status: 404 });
        }

        updates.songId = targetSong[0].id;
        if (targetSong[0].workspaceId) {
          updates.workspaceId = targetSong[0].workspaceId;
        }
      } else {
        return NextResponse.json({ error: "Invalid songId" }, { status: 400 });
      }
    }

    if (regenerateCoverArt !== undefined && regenerateCoverArt !== true) {
      if (typeof regenerateCoverArt !== "boolean") {
        return NextResponse.json({ error: "Invalid regenerateCoverArt" }, { status: 400 });
      }
    }

    if (sunoStyleInfluence !== undefined) {
      if (sunoStyleInfluence === null) {
        updates.sunoStyleInfluence = null;
      } else if (typeof sunoStyleInfluence === "number" && Number.isFinite(sunoStyleInfluence)) {
        updates.sunoStyleInfluence = Math.min(100, Math.max(1, Math.round(sunoStyleInfluence)));
      } else {
        return NextResponse.json({ error: "Invalid sunoStyleInfluence" }, { status: 400 });
      }
    }

    if (sunoWeirdness !== undefined) {
      if (sunoWeirdness === null) {
        updates.sunoWeirdness = null;
      } else if (typeof sunoWeirdness === "number" && Number.isFinite(sunoWeirdness)) {
        updates.sunoWeirdness = Math.min(100, Math.max(1, Math.round(sunoWeirdness)));
      } else {
        return NextResponse.json({ error: "Invalid sunoWeirdness" }, { status: 400 });
      }
    }

    if (releaseStatus !== undefined) {
      if (typeof releaseStatus !== "string" || !RELEASE_STATUSES.includes(releaseStatus as ReleaseStatus)) {
        return NextResponse.json({ error: "Invalid releaseStatus" }, { status: 400 });
      }
      updates.releaseStatus = releaseStatus;
    }

    if (publishDate !== undefined) {
      if (publishDate === null) {
        updates.publishDate = null;
      } else if (typeof publishDate === "string" && !isNaN(Date.parse(publishDate))) {
        updates.publishDate = new Date(publishDate);
      } else {
        return NextResponse.json({ error: "Invalid publishDate" }, { status: 400 });
      }
    }

    if (trackDna !== undefined) {
      if (trackDna !== null && typeof trackDna !== "string") {
        return NextResponse.json({ error: "Invalid trackDna" }, { status: 400 });
      }
      updates.trackDna = trackDna === null ? null : trackDna.trim() || null;
    }

    if (pollsOpenAt !== undefined) {
      if (pollsOpenAt === null) {
        updates.pollsOpenAt = null;
      } else if (typeof pollsOpenAt === "string" && !isNaN(Date.parse(pollsOpenAt))) {
        updates.pollsOpenAt = new Date(pollsOpenAt);
      } else {
        return NextResponse.json({ error: "Invalid pollsOpenAt" }, { status: 400 });
      }
    }

    if (pollsCloseAt !== undefined) {
      if (pollsCloseAt === null) {
        updates.pollsCloseAt = null;
      } else if (typeof pollsCloseAt === "string" && !isNaN(Date.parse(pollsCloseAt))) {
        updates.pollsCloseAt = new Date(pollsCloseAt);
      } else {
        return NextResponse.json({ error: "Invalid pollsCloseAt" }, { status: 400 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(result[0]);
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

  // Permanent hard delete (already in trash)
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";

  try {
    if (permanent) {
      if (track.s3Key) await deleteFromS3(track.s3Key);
      if (track.s3KeyHd) await deleteFromS3(track.s3KeyHd);
      if (track.s3KeyCover) await deleteFromS3(track.s3KeyCover);
      await db.delete(tracks).where(eq(tracks.id, id));
    } else {
      // Soft delete — move to recycle bin
      await db.update(tracks).set({ deletedAt: new Date() }).where(eq(tracks.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete track" }, { status: 500 });
  }
}
