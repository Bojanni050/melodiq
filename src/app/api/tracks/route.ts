import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, desc, and, inArray, ne, lt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { requireAuth } from "@/lib/require-auth";
import { extractPoYoErrorMessage, getPoYoStatus, getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { getOriginalPoYoTaskId, requestMissingWavConversion } from "@/lib/request-wav-conversion";
import { uploadToS3 } from "@/lib/s3";
import { contentTypeForFormat, detectFormatFromUrl, detectFormatFromContentType } from "@/lib/audio-format";
import { extractAudioDuration } from "@/lib/audio-duration";
import { workspaces } from "@/db/schema";
import {
  ensureDefaultWorkspaceForUser,
  ensureWorkspaceSchema,
  getUserWorkspacesWithTrackIds,
} from "@/lib/workspaces";
import { generateAndSaveCoverArtForBatch, generateAndSaveCoverArt } from "@/lib/generate-cover";
import { getTempolorStatus } from "@/lib/providers/tempolor";
import { getMusicGptConversionById } from "@/lib/providers/musicgpt";
import axios from "axios";

export const dynamic = "force-dynamic";

const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

const MAX_FILES_PER_UPLOAD = 20;
const MAX_TRACKS_PER_COVER_REGEN = 50;

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectUploadFormat(file: File): "mp3" | "wav" | null {
  const type = file.type.toLowerCase();
  const filename = file.name.toLowerCase();

  if (
    type.includes("mpeg") ||
    type.includes("mp3") ||
    filename.endsWith(".mp3")
  ) {
    return "mp3";
  }

  if (
    type.includes("wav") ||
    type.includes("wave") ||
    filename.endsWith(".wav")
  ) {
    return "wav";
  }

  return null;
}

function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "").trim();
  return withoutExtension || "Untitled Upload";
}

function getUploadErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (isJsonObject(error)) {
    if (typeof error.message === "string" && error.message.trim()) {
      return error.message.trim();
    }

    if (typeof error.error === "string" && error.error.trim()) {
      return error.error.trim();
    }

    const cause = error.cause;
    if (cause instanceof Error && cause.message.trim()) {
      return cause.message.trim();
    }

    if (typeof error.code === "string" && error.code.trim()) {
      return `${fallback} (${error.code.trim()})`;
    }
  }

  return fallback;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  const trackListSelect = {
    id: tracks.id,
    userId: tracks.userId,
    workspaceId: tracks.workspaceId,
    title: tracks.title,
    provider: tracks.provider,
    providerModel: tracks.providerModel,
    prompt: tracks.prompt,
    lyrics: tracks.lyrics,
    language: tracks.language,
    instrumental: tracks.instrumental,
    status: tracks.status,
    audioUrl: tracks.audioUrl,
    audioUrlHd: tracks.audioUrlHd,
    s3Key: tracks.s3Key,
    s3KeyHd: tracks.s3KeyHd,
    format: tracks.format,
    formatHd: tracks.formatHd,
    duration: tracks.duration,
    jobId: tracks.jobId,
    conversionId: tracks.conversionId,
    audioId: tracks.audioId,
    wavJobId: tracks.wavJobId,
    creditsUsed: tracks.creditsUsed,
    error: tracks.error,
    coverUrl: tracks.coverUrl,
    s3KeyCover: tracks.s3KeyCover,
    s3KeyCoverThumb: tracks.s3KeyCoverThumb,
    rating: tracks.rating,
    playCount: tracks.playCount,
    lyricsTimestamps: tracks.lyricsTimestamps,
    createdAt: tracks.createdAt,
    updatedAt: tracks.updatedAt,
  };

  const statusFilter = new URL(request.url).searchParams.get("status");
  const baseWhere = statusFilter
    ? and(eq(tracks.userId, userId), eq(tracks.status, statusFilter))
    : eq(tracks.userId, userId);

  // Run database timeout check before fetching tracks
  if (!statusFilter) {
    const timeoutCutoff = new Date(Date.now() - GENERATION_TIMEOUT_MS);
    await db.update(tracks)
      .set({ status: "failed", error: "Generation timed out. Please try again." })
      .where(
        and(
          eq(tracks.userId, userId),
          inArray(tracks.status, ["pending", "generating"]),
          ne(tracks.provider, "musicgpt"),
          lt(tracks.createdAt, timeoutCutoff)
        )
      );
  }

  // Active-polling fallback: Check status of active (pending/generating) tracks
  if (!statusFilter) {
    const activeTracks = await db
      .select()
      .from(tracks)
      .where(
        and(
          eq(tracks.userId, userId),
          inArray(tracks.status, ["pending", "generating"])
        )
      );

    if (activeTracks.length > 0) {
      await Promise.allSettled(
        activeTracks.map(async (track) => {
          // 1. PoYo (Suno) active polling fallback
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
              } else if (statusValue === "failed" || statusValue === "error") {
                const errorMessage = extractPoYoErrorMessage(status) || "Generation failed";
                console.error(`[tracks-api] PoYo generation failed for task ${sourceJobId} (track ${track.id}): ${errorMessage}`);
                await db
                  .update(tracks)
                  .set({ status: "failed", error: errorMessage })
                  .where(eq(tracks.id, track.id));
              }
            } catch (e: any) {
              console.error(`[tracks-api] Failed active polling for PoYo track ${track.id}:`, e?.message ?? e);
            }
          }

          // 2. Tempolor active polling fallback
          else if (track.provider === "tempolor" && track.jobId) {
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

                await db
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
                  .where(eq(tracks.id, track.id));
              } else if (status.status === "failed") {
                await db
                  .update(tracks)
                  .set({ status: "failed", error: status.error || "Generation failed" })
                  .where(eq(tracks.id, track.id));
              }
            } catch (e: any) {
              console.error(`[tracks-api] Failed active polling for Tempolor track ${track.id}:`, e?.message ?? e);
            }
          }

          // 3. MusicGPT active polling fallback
          else if (track.provider === "musicgpt" && track.conversionId) {
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

                  await db
                    .update(tracks)
                    .set({
                      status: "done",
                      s3Key,
                      format: "mp3",
                      duration,
                      audioUrl: `/api/tracks/${track.id}/download`,
                      error: null,
                    })
                    .where(eq(tracks.id, track.id));

                  if (!track.s3KeyCover) {
                    generateAndSaveCoverArt({
                      id: track.id,
                      userId: track.userId,
                      title: track.title,
                      prompt: track.prompt,
                      instrumental: track.instrumental,
                    }).catch((error) => console.error("[tracks-api] Cover art generation failed", error));
                  }
                } else if (status === "FAILED" || status.includes("FAIL")) {
                  await db
                    .update(tracks)
                    .set({
                      status: "failed",
                      error: conversion.status_msg || "Generation failed",
                    })
                    .where(eq(tracks.id, track.id));
                }
              }
            } catch (e: any) {
              console.error(`[tracks-api] Failed active polling for MusicGPT track ${track.id}:`, e?.message ?? e);
            }
          }
        })
      );
    }
  }

  const finalTracks = await db
    .select(trackListSelect)
    .from(tracks)
    .where(baseWhere)
    .orderBy(desc(tracks.createdAt));

  const workspacePayload = await getUserWorkspacesWithTrackIds(
    userId,
    finalTracks.map((track) => ({ id: track.id, workspaceId: track.workspaceId ?? null }))
  );

  return NextResponse.json(
    { tracks: finalTracks, workspaces: workspacePayload },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body: unknown = await request.json();
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const regenerateCoverArt = body.regenerateCoverArt;
  const trackIds = body.trackIds;

  if (regenerateCoverArt !== true || !Array.isArray(trackIds)) {
    return NextResponse.json({ error: "Unsupported operation" }, { status: 400 });
  }

  const normalizedIds = Array.from(
    new Set(
      trackIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (normalizedIds.length === 0) {
    return NextResponse.json({ error: "No trackIds provided" }, { status: 400 });
  }

  if (normalizedIds.length > MAX_TRACKS_PER_COVER_REGEN) {
    return NextResponse.json(
      { error: `Too many tracks selected (max ${MAX_TRACKS_PER_COVER_REGEN})` },
      { status: 400 }
    );
  }

  const rows = await db
    .select({
      id: tracks.id,
      userId: tracks.userId,
      title: tracks.title,
      prompt: tracks.prompt,
      instrumental: tracks.instrumental,
    })
    .from(tracks)
    .where(and(eq(tracks.userId, userId), inArray(tracks.id, normalizedIds)));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Tracks not found" }, { status: 404 });
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const ordered = normalizedIds
    .map((id) => rowById.get(id))
    .filter((row): row is (typeof rows)[number] => Boolean(row));

  await generateAndSaveCoverArtForBatch(
    {
      tracks: ordered.map((t) => ({
        id: t.id,
        userId: t.userId,
        prompt: t.prompt,
        title: t.title ?? null,
        instrumental: t.instrumental,
      })),
    },
    { forceNew: true }
  );

  return NextResponse.json({ success: true, trackIds: ordered.map((t) => t.id) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  try {
    const formData = await request.formData();
    const uploadedEntries = formData.getAll("files");
    const files = uploadedEntries.filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      return NextResponse.json(
        { error: `You can upload up to ${MAX_FILES_PER_UPLOAD} files at once.` },
        { status: 400 }
      );
    }

    const requestedWorkspaceIdRaw = formData.get("workspaceId");
    const requestedWorkspaceId =
      typeof requestedWorkspaceIdRaw === "string" && requestedWorkspaceIdRaw.trim()
        ? requestedWorkspaceIdRaw.trim()
        : null;

    const defaultWorkspace = await ensureDefaultWorkspaceForUser(userId);
    let targetWorkspaceId = defaultWorkspace.id;

    if (requestedWorkspaceId) {
      const workspaceResult = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.id, requestedWorkspaceId), eq(workspaces.userId, userId)))
        .limit(1);

      if (workspaceResult[0]) {
        targetWorkspaceId = workspaceResult[0].id;
      }
    }

    const uploadedTracks: Array<typeof tracks.$inferSelect> = [];
    const rejected: Array<{ filename: string; reason: string }> = [];

    for (const file of files) {
      const format = detectUploadFormat(file);
      if (!format) {
        rejected.push({ filename: file.name, reason: "Only MP3 and WAV files are supported." });
        continue;
      }

      if (file.size === 0) {
        rejected.push({ filename: file.name, reason: "File is empty." });
        continue;
      }

      try {
        const trackId = crypto.randomUUID();
        const audioBuffer = Buffer.from(await file.arrayBuffer());
        const uploadHash = createHash("sha256").update(audioBuffer).digest("hex");

        const duplicateTrack = await db
          .select({ id: tracks.id })
          .from(tracks)
          .where(
            and(
              eq(tracks.userId, userId),
              eq(tracks.provider, "upload"),
              eq(tracks.audioId, uploadHash)
            )
          )
          .limit(1);

        if (duplicateTrack.length > 0) {
          rejected.push({ filename: file.name, reason: "Duplicate upload detected." });
          continue;
        }

        const s3Key = `tracks/${trackId}/audio.${format}`;
        const duration = await extractAudioDuration(audioBuffer);

        await uploadToS3(s3Key, audioBuffer, contentTypeForFormat(format));

        const inserted = await db
          .insert(tracks)
          .values({
            id: trackId,
            userId,
            title: titleFromFilename(file.name),
            provider: "upload",
            providerModel: "manual-upload",
            prompt: `Uploaded file: ${file.name}`,
            status: "done",
            s3Key,
            format,
            duration,
            audioId: uploadHash,
            workspaceId: targetWorkspaceId,
            audioUrl: `/api/tracks/${trackId}/download`,
            instrumental: false,
            creditsUsed: 0,
            error: null,
          })
          .returning();

        if (inserted[0]) {
          uploadedTracks.push(inserted[0]);
        }
      } catch (error) {
        console.error("[tracks/upload] Failed to upload file:", file.name, error);
        rejected.push({ filename: file.name, reason: getUploadErrorMessage(error, "Upload failed.") });
      }
    }

    if (uploadedTracks.length === 0) {
      const uniqueReasons = Array.from(
        new Set(rejected.map((item) => item.reason.trim()).filter((reason) => reason.length > 0))
      );
      const reasonSummary = uniqueReasons.slice(0, 2).join(" | ");

      return NextResponse.json(
        {
          error: reasonSummary ? `No files were uploaded. ${reasonSummary}` : "No files were uploaded.",
          rejected,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      tracks: uploadedTracks,
      rejected,
    });
  } catch (error) {
    console.error("[tracks/upload] Unexpected upload error:", error);
    return NextResponse.json({ error: getUploadErrorMessage(error, "Failed to upload files") }, { status: 500 });
  }
}
