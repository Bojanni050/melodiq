import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, users } from "@/db/schema";
import { eq, desc, and, inArray, ne, lt, isNull, isNotNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { requireAuth } from "@/lib/require-auth";
import { extractPoYoErrorMessage, getPoYoStatus, getPoYoStatusValue } from "@/lib/providers/poyo";
import { syncPoYoTaskResult } from "@/lib/poyo-sync";
import { getOriginalPoYoTaskId, requestMissingWavConversion } from "@/lib/request-wav-conversion";
import { uploadToS3 } from "@/lib/s3";
import { contentTypeForFormat, detectFormatFromUrl, detectFormatFromContentType } from "@/lib/audio-format";
import { convertWavToFlac, saveWavLocally } from "@/lib/wav-to-flac";
import { extractAudioDuration } from "@/lib/audio-duration";
import { workspaces } from "@/db/schema";
import {
  ensureDefaultWorkspaceForUser,
  ensureWorkspaceSchema,
  getUserWorkspacesWithTrackIds,
} from "@/lib/workspaces";
import { generateAndSaveCoverArtForBatch, generateAndSaveCoverArt, processAndUploadCover } from "@/lib/generate-cover";
import { getTempolorStatus } from "@/lib/providers/tempolor";
import { getMusicGptConversionById } from "@/lib/providers/musicgpt";
import { parseLyrics } from "@/lib/parse-lyrics";
import axios from "axios";

export const dynamic = "force-dynamic";

const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

const MAX_FILES_PER_UPLOAD = 10;
const MAX_TRACKS_PER_COVER_REGEN = 50;
const MAX_UPLOAD_REQUEST_BYTES = 200 * 1024 * 1024;
const MAX_UPLOAD_REQUEST_MB = Math.round(MAX_UPLOAD_REQUEST_BYTES / (1024 * 1024));
const DEFAULT_WORKSPACE_SENTINEL = "workspace-default";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
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

function stripMp3Metadata(buffer: Buffer): Buffer {
  let start = 0;
  let end = buffer.length;

  // Remove leading ID3v2 tag when present.
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "ID3") {
    const tagSize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    const headerAndTagBytes = 10 + tagSize;
    if (headerAndTagBytes > 0 && headerAndTagBytes < buffer.length) {
      start = headerAndTagBytes;
    }
  }

  // Remove trailing ID3v1 tag when present.
  if (end - start >= 128 && buffer.toString("ascii", end - 128, end - 125) === "TAG") {
    end -= 128;
  }

  return buffer.subarray(start, end);
}

function stripWavMetadata(buffer: Buffer): Buffer {
  const minimumHeaderSize = 12;
  if (buffer.length < minimumHeaderSize) return buffer;

  const riffId = buffer.toString("ascii", 0, 4);
  const waveId = buffer.toString("ascii", 8, 12);
  if (riffId !== "RIFF" || waveId !== "WAVE") return buffer;

  const dataChunks: Buffer[] = [];
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = Math.min(chunkDataStart + chunkSize, buffer.length);

    if (chunkId === "data" && chunkDataEnd > chunkDataStart) {
      dataChunks.push(buffer.subarray(chunkDataStart, chunkDataEnd));
    }

    // WAV chunks are word-aligned, so odd-sized chunks include one pad byte.
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (dataChunks.length === 0) return buffer;
  return Buffer.concat(dataChunks);
}

function getAudioOnlyBytesForHash(audioBuffer: Buffer, format: "mp3" | "wav"): Buffer {
  if (format === "mp3") return stripMp3Metadata(audioBuffer);
  if (format === "wav") return stripWavMetadata(audioBuffer);
  return audioBuffer;
}

function computeUploadAudioHash(audioBuffer: Buffer, format: "mp3" | "wav"): string {
  const hashBytes = getAudioOnlyBytesForHash(audioBuffer, format);
  return createHash("sha256").update(hashBytes).digest("hex");
}

function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "").trim();
  return withoutExtension || "Untitled Upload";
}

type UploadMetadata = {
  prompt: string | null;
  lyrics: string | null;
  lyricsTimestamps: string | null;
};

type UploadItemOverride = {
  title: string | null;
  artistName: string | null;
  composerName: string | null;
  prompt: string | null;
  lyrics: string | null;
  instrumental: boolean | null;
  sourceProvider: string | null;
};

function normalizeUploadText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function baseNameWithoutExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, "").trim().toLowerCase();
}

function isSupportedMetadataFilename(filename: string) {
  const normalized = filename.toLowerCase();
  return normalized.endsWith(".txt") || normalized.endsWith(".lrc");
}

function extractLyricsFromTimestampedText(timestampedText: string): string | null {
  const lines = parseLyrics(null, timestampedText)
    .map((line) => line.text.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return null;
  return lines.join("\n");
}

function parseMetadataText(text: string): UploadMetadata {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return { prompt: null, lyrics: null, lyricsTimestamps: null };

  const promptMatch = normalized.match(/(?:^|\n)\s*prompt\s*:\s*([\s\S]*?)(?=\n\s*lyrics\s*:|$)/i);
  const lyricsMatch = normalized.match(/(?:^|\n)\s*lyrics\s*:\s*([\s\S]*)$/i);

  if (!promptMatch && !lyricsMatch) {
    return { prompt: null, lyrics: normalized, lyricsTimestamps: null };
  }

  const prompt = promptMatch?.[1]?.trim() || null;
  const lyrics = lyricsMatch?.[1]?.trim() || null;

  return { prompt, lyrics, lyricsTimestamps: null };
}

function parseMetadataFile(file: File, content: string): UploadMetadata {
  if (file.name.toLowerCase().endsWith(".lrc")) {
    const normalized = content.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return { prompt: null, lyrics: null, lyricsTimestamps: null };
    }

    return {
      prompt: null,
      lyrics: extractLyricsFromTimestampedText(normalized),
      lyricsTimestamps: normalized,
    };
  }

  return parseMetadataText(content);
}

function parseUploadItemOverrides(value: FormDataEntryValue | null): UploadItemOverride[] {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => {
      if (!isJsonObject(item)) return { title: null, artistName: null, composerName: null, prompt: null, lyrics: null, instrumental: null, sourceProvider: null };
      const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : null;
      const artistName = typeof item.artistName === "string" && item.artistName.trim() ? item.artistName.trim() : null;
      const composerName = typeof item.composerName === "string" && item.composerName.trim() ? item.composerName.trim() : null;
      const prompt = typeof item.prompt === "string" && item.prompt.trim() ? item.prompt.trim() : null;
      const lyrics = typeof item.lyrics === "string" && item.lyrics.trim() ? item.lyrics.trim() : null;
      const instrumental = typeof item.instrumental === "boolean" ? item.instrumental : null;
      const sourceProvider = typeof item.sourceProvider === "string" && item.sourceProvider.trim() ? item.sourceProvider.trim() : null;
      return { title, artistName, composerName, prompt, lyrics, instrumental, sourceProvider };
    });
  } catch {
    return [];
  }
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

function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === "string" && maybeCode === "23505") {
    return true;
  }

  const maybeCause = (error as { cause?: unknown }).cause;
  if (maybeCause && typeof maybeCause === "object") {
    const nestedCode = (maybeCause as { code?: unknown }).code;
    return typeof nestedCode === "string" && nestedCode === "23505";
  }

  return false;
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
    artistName: tracks.artistName,
    composerName: tracks.composerName,
    deletedAt: tracks.deletedAt,
    createdAt: tracks.createdAt,
    updatedAt: tracks.updatedAt,
  };

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const trashOnly = url.searchParams.get("trash") === "true";

  const baseWhere = trashOnly
    ? and(eq(tracks.userId, userId), isNotNull(tracks.deletedAt))
    : statusFilter
    ? and(eq(tracks.userId, userId), eq(tracks.status, statusFilter), isNull(tracks.deletedAt))
    : and(eq(tracks.userId, userId), isNull(tracks.deletedAt));

  // Run database timeout check before fetching tracks
  if (!statusFilter && !trashOnly) {
    const timeoutCutoff = new Date(Date.now() - GENERATION_TIMEOUT_MS);
    await db.update(tracks)
      .set({ status: "failed", error: "Generation timed out. Please try again." })
      .where(
        and(
          eq(tracks.userId, userId),
          inArray(tracks.status, ["pending", "generating"]),
          ne(tracks.provider, "musicgpt"),
          lt(tracks.createdAt, timeoutCutoff),
          isNull(tracks.deletedAt)
        )
      );
  }

  // Active-polling fallback: Check status of active (pending/generating) tracks
  if (!statusFilter && !trashOnly) {
    const activeTracks = await db
      .select()
      .from(tracks)
      .where(
        and(
          eq(tracks.userId, userId),
          inArray(tracks.status, ["pending", "generating"]),
          isNull(tracks.deletedAt)
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

    const userRow = await db.select({ name: users.name, artistAlias: users.artistAlias, composerAlias: users.composerAlias }).from(users).where(eq(users.id, userId)).limit(1);
    const defaultComposer = userRow[0]?.composerAlias?.trim() || userRow[0]?.name?.trim() || null;
    const defaultArtist = userRow[0]?.artistAlias?.trim() || userRow[0]?.name?.trim() || null;
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

    const uploadedTracks: Array<typeof tracks.$inferSelect> = [];
    const rejected: Array<{ filename: string; reason: string }> = [];

    for (const [index, file] of files.entries()) {
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
        let uploadFormat: "mp3" | "wav" | "flac" = format;

        if (format === "wav") {
          await saveWavLocally(trackId, audioBuffer).catch(() => {});
          const flacBuffer = await convertWavToFlac(audioBuffer);
          if (flacBuffer) {
            uploadBuffer = flacBuffer;
            uploadFormat = "flac";
          }
          // If ffmpeg unavailable, uploadBuffer/uploadFormat stay as WAV — upload as-is
        }

        const s3Key = `tracks/${trackId}/audio.${uploadFormat}`;
        const duration = await extractAudioDuration(audioBuffer);

        await uploadToS3(s3Key, uploadBuffer, contentTypeForFormat(uploadFormat));

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
            format: uploadFormat,
            duration,
            audioId: uploadHash,
            workspaceId: targetWorkspaceId,
            audioUrl: `/api/tracks/${trackId}/download`,
            instrumental: isInstrumental,
            artistName: itemOverride?.artistName ?? defaultArtist,
            composerName: itemOverride?.composerName ?? defaultComposer,
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
          uploadedTracks.push(inserted[0]);
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
