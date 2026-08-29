import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { tracks, users } from "@/db/schema";
import { eq, desc, and, inArray, ne, lt, isNull, isNotNull, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { extractPoYoErrorMessage, getPoYoStatus, getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { getOriginalPoYoTaskId } from "@/lib/request-wav-conversion";
import { retryStaleApimartAlignedLyrics } from "@/lib/apimart-lyrics";
import { retryStaleApimartWavConversions } from "@/lib/apimart-wav";
import { uploadToS3, deleteFromS3 } from "@/lib/s3";
import { type AudioFormat, contentTypeForFormat, detectFormatFromUrl, detectFormatFromContentType } from "@/lib/audio-format";
import { convertWavToFlac, saveWavLocally } from "@/lib/wav-to-flac";
import { transcodeToOgg } from "@/lib/transcode";
import { extractAudioDuration } from "@/lib/audio-duration";
import { computeAudioDna } from "@/lib/audio-dna";
import { workspaces } from "@/db/schema";
import {
  ensureDefaultWorkspaceForUser,
  ensureWorkspaceSchema,
  getUserWorkspacesWithTrackIds,
} from "@/lib/workspaces";
import { generateAndSaveCoverArtForBatch, generateAndSaveCoverArt, processAndUploadCover } from "@/lib/generate-cover";
import { detectAndSaveLanguageIfMissing } from "@/lib/language-detect";
import { getTempolorStatus } from "@/lib/providers/tempolor";
import { getApiframeStatus } from "@/lib/providers/apiframe";
import { getApimartTaskStatus, createApimartAlignedLyrics } from "@/lib/providers/apimart";
import { getMusicGptConversionById } from "@/lib/providers/musicgpt";
import axios from "axios";
import {
  extractAudioUrls,
  isJsonObject,
  isUuid,
  detectUploadFormat,
  computeUploadAudioHash,
  titleFromFilename,
  normalizeUploadText,
  baseNameWithoutExtension,
  isSupportedMetadataFilename,
  parseMetadataFile,
  parseUploadItemOverrides,
  getUploadErrorMessage,
  isUniqueConstraintViolation,
  type UploadMetadata,
} from "./upload-helpers";

export const dynamic = "force-dynamic";

const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

const MAX_FILES_PER_UPLOAD = 10;
const MAX_TRACKS_PER_COVER_REGEN = 50;
const MAX_UPLOAD_REQUEST_BYTES = 200 * 1024 * 1024;
const MAX_UPLOAD_REQUEST_MB = Math.round(MAX_UPLOAD_REQUEST_BYTES / (1024 * 1024));
const DEFAULT_WORKSPACE_SENTINEL = "workspace-default";

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
    translatedLanguage: tracks.translatedLanguage,
    instrumental: tracks.instrumental,
    isCollaboration: tracks.isCollaboration,
    status: tracks.status,
    audioUrl: tracks.audioUrl,
    audioUrlHd: tracks.audioUrlHd,
    s3Key: tracks.s3Key,
    s3KeyHd: tracks.s3KeyHd,
    s3KeyMp3: tracks.s3KeyMp3,
    s3KeyOgg: tracks.s3KeyOgg,
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
    othersPlayCount: tracks.othersPlayCount,
    votedAt: tracks.votedAt,
    releaseStatus: tracks.releaseStatus,
    publishDate: tracks.publishDate,
    audioDna: tracks.audioDna,
    // translatedLyrics / trackDna / advancedDna are multi-paragraph blobs that
    // only ever render inside on-demand panels, so the list ships a presence
    // flag instead and the panel hydrates the body from GET /api/tracks/[id].
    hasAdvancedDna: sql<boolean>`${tracks.advancedDna} IS NOT NULL`,
    lyricsTimestamps: tracks.lyricsTimestamps,
    artistName: tracks.artistName,
    composerName: tracks.composerName,
    writerName: tracks.writerName,
    archivedAt: tracks.archivedAt,
    deletedAt: tracks.deletedAt,
    completedAt: tracks.completedAt,
    createdAt: tracks.createdAt,
    updatedAt: tracks.updatedAt,
  };

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const trashOnly = url.searchParams.get("trash") === "true";
  const archivedOnly = url.searchParams.get("archived") === "true";

  // archivedOnly wint: toon alleen gearchiveerde tracks (ongeacht trash/
  // status), zodat het Archief-tabblad zelfstandig kan poll-en.
  const baseWhere = archivedOnly
    ? and(eq(tracks.userId, userId), isNotNull(tracks.archivedAt), isNull(tracks.deletedAt))
    : trashOnly
    ? and(eq(tracks.userId, userId), isNotNull(tracks.deletedAt))
    : statusFilter
    ? and(eq(tracks.userId, userId), eq(tracks.status, statusFilter), isNull(tracks.deletedAt), isNull(tracks.archivedAt))
    : and(eq(tracks.userId, userId), isNull(tracks.deletedAt), isNull(tracks.archivedAt));

  // Run database timeout check before fetching tracks
  if (!statusFilter && !trashOnly && !archivedOnly) {
    const timeoutCutoff = new Date(Date.now() - GENERATION_TIMEOUT_MS);
    await db.update(tracks)
      .set({ status: "failed", error: "Generation timed out. Please try again." })
      .where(
        and(
          eq(tracks.userId, userId),
          inArray(tracks.status, ["pending", "generating"]),
          ne(tracks.provider, "musicgpt"),
          lt(tracks.createdAt, timeoutCutoff),
          isNull(tracks.deletedAt),
          isNull(tracks.archivedAt)
        )
      );
  }

  // Active-polling fallback: Check status of active (pending/generating) tracks
  if (!statusFilter && !trashOnly && !archivedOnly) {
    const activeTracks = await db
      .select()
      .from(tracks)
      .where(
        and(
          eq(tracks.userId, userId),
          inArray(tracks.status, ["pending", "generating"]),
          isNull(tracks.deletedAt),
          isNull(tracks.archivedAt)
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
                // WAV/HD conversion is no longer requested automatically here — the
                // user triggers it on-demand via the "Convert to WAV" track menu action.
                await syncPoYoTaskResult(sourceJobId, status);
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

          // 2b. APIFrame active polling fallback
          else if (track.provider === "apiframe" && track.jobId) {
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
                  const [duration, audioDna] = await Promise.all([
                    extractAudioDuration(mp3Buffer),
                    computeAudioDna({
                      audioBuffer: mp3Buffer,
                      prompt: track.prompt,
                      lyrics: track.lyrics,
                      instrumental: track.instrumental,
                    }),
                  ]);

                  await uploadToS3(s3Key, mp3Buffer, "audio/mpeg");

                  await db
                    .update(tracks)
                    .set({
                      status: "done",
                      s3Key,
                      format,
                      duration,
                      audioDna,
                      audioUrl: `/api/tracks/${track.id}/download`,
                    })
                    .where(eq(tracks.id, track.id));

                  if (!track.language) {
                    detectAndSaveLanguageIfMissing({
                      id: track.id!,
                      language: track.language,
                      lyrics: track.lyrics,
                      instrumental: track.instrumental,
                    }).catch((error) => console.error("[tracks-api] language detection failed (apiframe)", error));
                  }
                }
              } else if (statusStr === "failed" || statusStr === "error") {
                await db
                  .update(tracks)
                  .set({ status: "failed", error: status.error || "Generation failed" })
                  .where(eq(tracks.id, track.id));
              }
            } catch (e: any) {
              console.error(`[tracks-api] Failed active polling for APIFrame track ${track.id}:`, e?.message ?? e);
            }
          }

          // 2c. APIMart active polling fallback
          else if (track.provider === "apimart" && track.jobId) {
            try {
              const parentJobId = track.jobId.split(":")[0];
              const status = await getApimartTaskStatus(parentJobId);

              if (status.status === "completed") {
                const isSecond = track.jobId.endsWith(":1");
                const result = isSecond ? status.tracks[1] : status.tracks[0];

                if (result?.audioUrl) {
                  const mp3Res = await axios.get(result.audioUrl, { responseType: "arraybuffer", timeout: 60000 });
                  const mp3Buffer = Buffer.from(mp3Res.data);
                  const format = "mp3";
                  const s3Key = `tracks/${track.id}/audio.${format}`;
                  const [duration, audioDna] = await Promise.all([
                    extractAudioDuration(mp3Buffer),
                    computeAudioDna({
                      audioBuffer: mp3Buffer,
                      prompt: track.prompt,
                      lyrics: track.lyrics,
                      instrumental: track.instrumental,
                    }),
                  ]);

                  await uploadToS3(s3Key, mp3Buffer, "audio/mpeg");

                  await db
                    .update(tracks)
                    .set({
                      status: "done",
                      s3Key,
                      format,
                      duration,
                      audioDna,
                      audioUrl: `/api/tracks/${track.id}/download`,
                    })
                    .where(eq(tracks.id, track.id));

                  if (!track.language) {
                    detectAndSaveLanguageIfMissing({
                      id: track.id!,
                      language: track.language,
                      lyrics: track.lyrics,
                      instrumental: track.instrumental,
                    }).catch((error) => console.error("[tracks-api] language detection failed (apimart)", error));
                  }

                  if (!track.instrumental) {
                    const audioIndex = isSecond ? 2 : 1;
                    createApimartAlignedLyrics(parentJobId, audioIndex)
                      .then((submitRes) =>
                        db
                          .update(tracks)
                          .set({ lyricsTimestamps: JSON.stringify({ task_id: submitRes.taskId }) })
                          .where(eq(tracks.id, track.id))
                      )
                      .catch((error) => console.error("[tracks-api] aligned lyrics submit failed (apimart)", error));
                  }

                  // WAV/HD conversion is no longer requested automatically here — the
                  // user triggers it on-demand via the "Convert to WAV" track menu action.
                }
              } else if (status.status === "failed") {
                await db
                  .update(tracks)
                  .set({ status: "failed", error: status.error || "Generation failed" })
                  .where(eq(tracks.id, track.id));
              }
            } catch (e: any) {
              console.error(`[tracks-api] Failed active polling for APIMart track ${track.id}:`, e?.message ?? e);
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

                  const [duration, audioDna] = await Promise.all([
                    extractAudioDuration(audioBuffer),
                    computeAudioDna({
                      audioBuffer,
                      prompt: track.prompt,
                      lyrics: track.lyrics,
                      instrumental: track.instrumental,
                    }),
                  ]);

                  await db
                    .update(tracks)
                    .set({
                      status: "done",
                      s3Key,
                      format: "mp3",
                      duration,
                      audioDna,
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

    // WAV/HD conversion is still opt-in — a brand-new conversion is only ever
    // started via the "Convert to WAV" track menu action. But once a
    // conversion has been requested (wavJobId set), poll it here so a
    // completed APIMart job gets downloaded and attached to the track
    // automatically on the next Library load, instead of requiring the user
    // to manually click retry again after it finishes.
    void retryStaleApimartWavConversions(userId, undefined, { onlyPollPending: true }).catch((e: any) =>
      console.error("[tracks-api] retryStaleApimartWavConversions failed:", e?.message ?? e)
    );

    // Resolve APIMart aligned-lyrics receipts that outlived the in-component
    // poller's ~75s window (see apimart-lyrics.ts for why that's needed).
    void retryStaleApimartAlignedLyrics(userId).catch((e: any) =>
      console.error("[tracks-api] retryStaleApimartAlignedLyrics failed:", e?.message ?? e)
    );
  }

  const finalTracks = await db
    .select(trackListSelect)
    .from(tracks)
    .where(baseWhere)
    .orderBy(desc(tracks.createdAt));

  if (finalTracks.some((track) => !track.artistName)) {
    const [owner] = await db
      .select({ artistAlias: users.artistAlias, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const fallbackArtistName = owner?.artistAlias?.trim() || owner?.name?.trim() || null;
    if (fallbackArtistName) {
      for (const track of finalTracks) {
        if (!track.artistName) track.artistName = fallbackArtistName;
      }
    }
  }

  const workspacePayload = await getUserWorkspacesWithTrackIds(
    userId,
    finalTracks.map((track) => ({ id: track.id, workspaceId: track.workspaceId ?? null }))
  );

  // The library polls this endpoint every 5-30s and the payload is byte-identical
  // most of the time, so serve a conditional response: an unchanged library costs
  // a 304 with no body instead of re-sending (and re-parsing) the whole list.
  // `no-cache` — not `no-store` — is what lets the browser keep the body around
  // to revalidate against.
  const payload = JSON.stringify({ tracks: finalTracks, workspaces: workspacePayload });
  const etag = `W/"${createHash("sha1").update(payload).digest("base64url")}"`;
  const cacheHeaders = { "Cache-Control": "private, no-cache", ETag: etag };

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders });
  }

  return new NextResponse(payload, {
    status: 200,
    headers: { ...cacheHeaders, "Content-Type": "application/json" },
  });
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
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Invalid upload request. Please upload files using the file picker." },
        { status: 415 }
      );
    }

    const contentLength = Number.parseInt(request.headers.get("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_REQUEST_BYTES) {
      return NextResponse.json(
        { error: `Upload is too large. Current server limit is ${MAX_UPLOAD_REQUEST_MB}MB.` },
        { status: 413 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      const parseError = getUploadErrorMessage(error, "Failed to parse upload body.");
      const likelyTooLarge = /too\s*large|payload|content\s*length|body\s*size|entity\s*too\s*large/i.test(parseError);

      return NextResponse.json(
        {
          error: likelyTooLarge
            ? `Upload is too large. Current server limit is ${MAX_UPLOAD_REQUEST_MB}MB.`
            : "Could not read upload form data. Please reselect files and try again.",
          details: parseError,
        },
        { status: likelyTooLarge ? 413 : 400 }
      );
    }

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
    const globalUploadPrompt = normalizeUploadText(formData.get("uploadPrompt"));
    const globalUploadLyrics = normalizeUploadText(formData.get("uploadLyrics"));
    const globalUploadInstrumental = formData.get("instrumental") === "true";
    const uploadItemOverrides = parseUploadItemOverrides(formData.get("uploadItems"));

    const userRow = await db.select({ name: users.name, artistAlias: users.artistAlias, composerAlias: users.composerAlias, writerAlias: users.writerAlias }).from(users).where(eq(users.id, userId)).limit(1);
    const defaultComposer = userRow[0]?.composerAlias?.trim() || userRow[0]?.name?.trim() || null;
    const defaultArtist = userRow[0]?.artistAlias?.trim() || userRow[0]?.name?.trim() || null;
    const defaultWriter = userRow[0]?.writerAlias?.trim() || defaultArtist;
    const metadataEntries = formData.getAll("metadataFiles");
    const metadataFiles = metadataEntries.filter(
      (entry): entry is File => entry instanceof File && isSupportedMetadataFilename(entry.name)
    );

    const metadataByBaseName = new Map<string, UploadMetadata>();
    for (const metadataFile of metadataFiles) {
      try {
        const content = new TextDecoder("utf-8").decode(await metadataFile.arrayBuffer());
        const parsed = parseMetadataFile(metadataFile, content);

        if (!parsed.prompt && !parsed.lyrics && !parsed.lyricsTimestamps) continue;
        metadataByBaseName.set(baseNameWithoutExtension(metadataFile.name), parsed);
      } catch (error) {
        console.error("[tracks/upload] Failed to parse metadata file:", metadataFile.name, error);
      }
    }

    const licenseFileByIndex = new Map<number, File>();
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("licenseFile:")) continue;
      if (!(value instanceof File)) continue;
      const index = Number.parseInt(key.slice("licenseFile:".length), 10);
      if (Number.isFinite(index) && index >= 0) licenseFileByIndex.set(index, value);
    }

    const coverFileByIndex = new Map<number, File>();
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("coverFile:")) continue;
      if (!(value instanceof File)) continue;
      const index = Number.parseInt(key.slice("coverFile:".length), 10);
      if (Number.isFinite(index) && index >= 0) coverFileByIndex.set(index, value);
    }

    const metadataByIndex = new Map<number, UploadMetadata>();
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("metadataFile:")) continue;
      if (!(value instanceof File) || !isSupportedMetadataFilename(value.name)) continue;

      const indexRaw = key.slice("metadataFile:".length);
      const index = Number.parseInt(indexRaw, 10);
      if (!Number.isFinite(index) || index < 0) continue;

      try {
        const content = new TextDecoder("utf-8").decode(await value.arrayBuffer());
        const parsed = parseMetadataFile(value, content);
        if (!parsed.prompt && !parsed.lyrics && !parsed.lyricsTimestamps) continue;
        metadataByIndex.set(index, parsed);
      } catch (error) {
        console.error("[tracks/upload] Failed to parse indexed metadata file:", value.name, error);
      }
    }

    const defaultWorkspace = await ensureDefaultWorkspaceForUser(userId);
    let targetWorkspaceId = defaultWorkspace.id;

    if (requestedWorkspaceId === DEFAULT_WORKSPACE_SENTINEL) {
      targetWorkspaceId = defaultWorkspace.id;
    } else if (requestedWorkspaceId && isUuid(requestedWorkspaceId)) {
      const workspaceResult = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.id, requestedWorkspaceId), eq(workspaces.userId, userId)))
        .limit(1);

      if (workspaceResult[0]) {
        targetWorkspaceId = workspaceResult[0].id;
      }
    }

    const uploadedTracks: Array<typeof tracks.$inferSelect & { uploadIndex: number }> = [];
    const rejected: Array<{ filename: string; reason: string }> = [];

    for (const [index, file] of files.entries()) {
      const format = detectUploadFormat(file);
      if (!format) {
        rejected.push({ filename: file.name, reason: "Only MP3, WAV, FLAC, and OGG files are supported." });
        continue;
      }

      if (file.size === 0) {
        rejected.push({ filename: file.name, reason: "File is empty." });
        continue;
      }

      try {
        const trackId = crypto.randomUUID();
        const audioBuffer = Buffer.from(await file.arrayBuffer());
        const uploadHash = computeUploadAudioHash(audioBuffer, format);
        const sidecarMetadata = metadataByIndex.get(index) ?? metadataByBaseName.get(baseNameWithoutExtension(file.name));
        const itemOverride = uploadItemOverrides[index];
        const isInstrumental = itemOverride?.instrumental ?? globalUploadInstrumental;
        const resolvedProvider = itemOverride?.sourceProvider ?? "upload";
        const uploadPrompt = sidecarMetadata?.prompt ?? itemOverride?.prompt ?? globalUploadPrompt ?? `Uploaded file: ${file.name}`;
        const uploadLyrics = isInstrumental ? null : (sidecarMetadata?.lyrics ?? itemOverride?.lyrics ?? globalUploadLyrics ?? null);
        const uploadLyricsTimestamps = sidecarMetadata?.lyricsTimestamps ?? null;
        const uploadTitle = itemOverride?.title ?? titleFromFilename(file.name);

        const duplicateTrack = await db
          .select({ id: tracks.id })
          .from(tracks)
          .where(
            and(
              eq(tracks.userId, userId),
              eq(tracks.audioId, uploadHash)
            )
          )
          .limit(1);

        if (duplicateTrack.length > 0) {
          rejected.push({ filename: file.name, reason: "Duplicate upload detected." });
          continue;
        }

        let uploadBuffer: Buffer = audioBuffer;
        let uploadFormat: AudioFormat = format;
        let s3KeyHd: string | null = null;
        let formatHd: AudioFormat | null = null;
        let s3KeyOgg: string | null = null;
        let s3KeyMp3: string | null = null;

        if (format === "ogg") {
          s3KeyOgg = `tracks/${trackId}/audio.ogg`;
          uploadFormat = "ogg";
        } else if (format === "wav") {
          await saveWavLocally(trackId, audioBuffer).catch(() => {});
          const flacBuffer = await convertWavToFlac(audioBuffer);
          if (flacBuffer) {
            uploadBuffer = flacBuffer;
            uploadFormat = "flac";
            s3KeyHd = `tracks/${trackId}/audio_hd.flac`;
            formatHd = "flac";
          } else {
            s3KeyHd = `tracks/${trackId}/audio_hd.wav`;
            formatHd = "wav";
          }
        } else if (format === "flac") {
          s3KeyHd = `tracks/${trackId}/audio_hd.flac`;
          formatHd = "flac";
        } else {
          // mp3
          s3KeyMp3 = `tracks/${trackId}/audio.mp3`;
        }

        const s3Key = format === "ogg" ? s3KeyOgg! : `tracks/${trackId}/audio.${uploadFormat}`;
        const [duration, audioDna] = await Promise.all([
          extractAudioDuration(audioBuffer, format),
          computeAudioDna({
            audioBuffer,
            prompt: uploadPrompt,
            lyrics: uploadLyrics,
            instrumental: isInstrumental,
          }),
        ]);

        await uploadToS3(s3Key, uploadBuffer, contentTypeForFormat(uploadFormat));
        if (s3KeyHd && s3KeyHd !== s3Key) {
          await uploadToS3(s3KeyHd, uploadBuffer, contentTypeForFormat(formatHd || uploadFormat));
        }

        let s3KeyLicense: string | null = null;
        const licenseFile = licenseFileByIndex.get(index);
        if (licenseFile) {
          try {
            const licenseBuffer = Buffer.from(await licenseFile.arrayBuffer());
            s3KeyLicense = `tracks/${trackId}/license.pdf`;
            await uploadToS3(s3KeyLicense, licenseBuffer, "application/pdf");
          } catch (err: any) {
            console.error(`[tracks/upload] Failed to upload license PDF for track ${trackId}:`, err?.message ?? err);
            s3KeyLicense = null;
          }
        }

        const inserted = await db
          .insert(tracks)
          .values({
            id: trackId,
            userId,
            title: uploadTitle,
            provider: resolvedProvider,
            providerModel: "manual-upload",
            prompt: uploadPrompt,
            lyrics: uploadLyrics,
            lyricsTimestamps: uploadLyricsTimestamps,
            status: "done",
            s3Key,
            s3KeyHd,
            s3KeyMp3,
            s3KeyOgg,
            format: uploadFormat,
            formatHd,
            duration,
            audioDna,
            audioId: uploadHash,
            workspaceId: targetWorkspaceId,
            audioUrl: `/api/tracks/${trackId}/download`,
            audioUrlHd: s3KeyHd ? `/api/tracks/${trackId}/download?hd=true` : null,
            instrumental: isInstrumental,
            artistName: itemOverride?.artistName ?? defaultArtist,
            composerName: itemOverride?.composerName ?? defaultComposer,
            writerName: itemOverride?.writerName ?? defaultWriter,
            sunoStyleInfluence: itemOverride?.sunoStyleInfluence ?? null,
            sunoWeirdness: itemOverride?.sunoWeirdness ?? null,
            s3KeyLicense,
            creditsUsed: 0,
            error: null,
          })
          .returning();

        if (inserted[0]) {
          const coverFile = coverFileByIndex.get(index);
          if (coverFile) {
            try {
              const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
              const { s3KeyCover, s3KeyCoverThumb } = await processAndUploadCover(coverBuffer, trackId);
              await db.update(tracks).set({
                s3KeyCover,
                s3KeyCoverThumb,
                coverUrl: `/api/tracks/${trackId}/cover`,
              }).where(eq(tracks.id, trackId));
              inserted[0].s3KeyCover = s3KeyCover;
              inserted[0].s3KeyCoverThumb = s3KeyCoverThumb;
              inserted[0].coverUrl = `/api/tracks/${trackId}/cover`;
            } catch (err: any) {
              console.error(`[tracks/upload] Failed to upload cover for track ${trackId}:`, err?.message ?? err);
            }
          } else {
            generateAndSaveCoverArt({
              id: trackId,
              userId,
              title: uploadTitle,
              prompt: uploadPrompt,
              instrumental: isInstrumental,
              lyrics: uploadLyrics ?? undefined,
            });
          }

          detectAndSaveLanguageIfMissing({
            id: trackId,
            language: inserted[0].language,
            lyrics: uploadLyrics,
            instrumental: isInstrumental,
          }).catch((error) => console.error("[tracks/upload] language detection failed", error));

          // Background OGG Vorbis transcoding ONLY after upload has succeeded
          if (format !== "ogg") {
            (async () => {
              try {
                const oggBuffer = await transcodeToOgg(audioBuffer);
                const s3KeyOgg = `tracks/${trackId}/audio.ogg`;
                await uploadToS3(s3KeyOgg, oggBuffer, "audio/ogg");

                // If uploaded format was MP3, delete the MP3 version from S3 after successful OGG conversion
                if (format === "mp3") {
                  const mp3Key = s3KeyMp3 || `tracks/${trackId}/audio.mp3`;
                  try {
                    await deleteFromS3(mp3Key);
                    console.log(`[tracks/upload] Deleted MP3 version ${mp3Key} for track ${trackId}`);
                  } catch (delErr: any) {
                    console.error(`[tracks/upload] Failed to delete MP3 for track ${trackId}:`, delErr?.message ?? delErr);
                  }

                  await db
                    .update(tracks)
                    .set({
                      s3KeyOgg,
                      s3Key: s3KeyOgg,
                      format: "ogg",
                      s3KeyMp3: null,
                      updatedAt: new Date(),
                    })
                    .where(eq(tracks.id, trackId));
                } else {
                  // For WAV / FLAC, keep lossless HD file and set s3KeyOgg
                  await db.update(tracks).set({ s3KeyOgg, updatedAt: new Date() }).where(eq(tracks.id, trackId));
                }

                console.log(`[tracks/upload] Background OGG transcode completed for track ${trackId}`);
              } catch (oggErr: any) {
                console.error(`[tracks/upload] Background OGG transcode failed for track ${trackId}:`, oggErr?.message ?? oggErr);
              }
            })().catch(() => {});
          }

          uploadedTracks.push({ ...inserted[0], uploadIndex: index });
        }
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          rejected.push({ filename: file.name, reason: "Duplicate upload detected." });
          continue;
        }

        console.error("[tracks/upload] Failed to upload file:", file.name, error);
        rejected.push({ filename: file.name, reason: getUploadErrorMessage(error, "Upload failed.") });
      }
    }

    if (uploadedTracks.length === 0) {
      const uniqueReasons = Array.from(
        new Set(rejected.map((item) => item.reason.trim()).filter((reason) => reason.length > 0))
      );
      const reasonSummary = uniqueReasons.join(" | ");

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
