import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateAndSaveCoverArt, generateAndSaveCoverArtForBatch } from "@/lib/generate-cover";
import { detectAndSaveLanguageIfMissing } from "@/lib/language-detect";

export type TrackInsertParams = {
  userId: string;
  provider: string;
  providerModel?: string;
  prompt: string;
  lyrics?: string | null;
  instrumental: boolean;
  title?: string | null;
  artistName?: string | null;
  writerName?: string | null;
  status?: "pending" | "generating" | "done" | "failed";
  jobId?: string;
  conversionId?: string;
  s3Key?: string;
  s3KeyHd?: string;
  s3KeyOgg?: string;
  format?: "mp3" | "wav" | "flac" | "ogg";
  formatHd?: "mp3" | "wav" | "flac" | "ogg";
  audioUrl?: string;
  audioUrlHd?: string;
};

/** Insert a new track row with status "pending". */
export async function insertPendingTrack(params: Omit<TrackInsertParams, "status">) {
  const [track] = await db
    .insert(tracks)
    .values({
      userId: params.userId,
      provider: params.provider,
      providerModel: params.providerModel ?? "",
      prompt: params.prompt,
      lyrics: params.lyrics,
      instrumental: params.instrumental,
      title: params.title,
      artistName: params.artistName,
      writerName: params.writerName,
      jobId: params.jobId,
      conversionId: params.conversionId,
      status: "pending" as const,
    })
    .returning();
  return track;
}

/**
 * Pre-assign S3 keys/URLs on a pending track (used by async providers that
 * need URLs before the audio is generated).
 */
export async function reserveTrackS3Keys(
  trackId: string,
  opts: { format?: "mp3" | "wav" | "flac" | "ogg"; formatHd?: "mp3" | "wav" | "flac" | "ogg" } = {}
) {
  const format = opts.format ?? "mp3";
  const formatHd = opts.formatHd ?? "wav";
  const [reserved] = await db
    .update(tracks)
    .set({
      s3Key: `tracks/${trackId}/audio.${format}`,
      s3KeyHd: `tracks/${trackId}/audio_hd.${formatHd}`,
      format,
      formatHd,
      audioUrl: `/api/tracks/${trackId}/download`,
      audioUrlHd: `/api/tracks/${trackId}/download?hd=true`,
    })
    .where(eq(tracks.id, trackId))
    .returning();
  return reserved;
}

/** Mark a track as generating with a provider job ID. */
export async function markTrackGenerating(
  trackId: string,
  jobId: string,
  extra?: Partial<Pick<TrackInsertParams, "provider" | "providerModel">>
) {
  const [updated] = await db
    .update(tracks)
    .set({ status: "generating", jobId, error: null, ...extra })
    .where(eq(tracks.id, trackId))
    .returning();
  return updated;
}

/** Mark a track as done with audio metadata. */
export async function markTrackDone(
  trackId: string,
  fields: {
    s3Key: string;
    format: "mp3" | "wav" | "flac" | "ogg";
    audioUrl: string;
    s3KeyHd?: string | null;
    formatHd?: "mp3" | "wav" | "flac" | "ogg" | null;
    s3KeyOgg?: string | null;
    audioUrlHd?: string | null;
    duration?: number | null;
    audioDna?: string | null;
  }
) {
  const [updated] = await db
    .update(tracks)
    .set({ status: "done", ...fields })
    .where(eq(tracks.id, trackId))
    .returning();
  return updated;
}

/**
 * Mark a track as failed. If the track is still "pending", deletes it instead
 * (avoids orphan rows for requests that never started generating).
 */
export async function markTrackFailed(trackId: string, errorMessage: string) {
  const deleted = await db
    .delete(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.status, "pending")))
    .returning({ id: tracks.id });

  if (deleted.length === 0) {
    await db
      .update(tracks)
      .set({ status: "failed", error: errorMessage })
      .where(eq(tracks.id, trackId));
  }
}

/** Mark multiple tracks as failed (used by PoYo dual-track generation). */
export async function markTracksFailedBatch(trackIds: string[], errorMessage: string) {
  await Promise.all(trackIds.map((id) => markTrackFailed(id, errorMessage)));
}

type CoverArtTrackInput = {
  id: string;
  userId: string;
  prompt: string;
  title?: string | null;
  instrumental: boolean;
  lyrics?: string;
};

/** Fire-and-forget: generate + save cover art for a single track. */
export function spawnCoverArtAsync(track: CoverArtTrackInput, tag: string) {
  generateAndSaveCoverArt({
    id: track.id,
    userId: track.userId,
    title: track.title ?? null,
    prompt: track.prompt,
    instrumental: track.instrumental,
    lyrics: track.lyrics,
  }).catch((err) => console.error(`[generate] cover art failed (${tag})`, err));
}

/** Fire-and-forget: generate + save cover art for a batch of tracks. */
export function spawnCoverArtBatchAsync(
  trackList: CoverArtTrackInput[],
  resolvedTitle: string | null | undefined,
  tag: string
) {
  generateAndSaveCoverArtForBatch({
    tracks: trackList.map((t) => ({
      id: t.id,
      userId: t.userId,
      prompt: t.prompt,
      title: resolvedTitle ?? null,
      instrumental: t.instrumental,
    })),
  }).catch((err) => console.error(`[generate] cover art batch failed (${tag})`, err));
}

/** Fire-and-forget: detect and save language for a track. */
export function spawnLanguageDetectionAsync(
  track: { id: string; language?: string | null },
  lyrics: string | undefined,
  instrumental: boolean,
  tag: string
) {
  if (track.language) return;
  detectAndSaveLanguageIfMissing({
    id: track.id,
    language: track.language,
    lyrics,
    instrumental,
  }).catch((err) => console.error(`[generate] language detection failed (${tag})`, err));
}

