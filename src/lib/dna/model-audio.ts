import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { tracks } from "@/db/schema";
import { ensureInspoMp3Source } from "@/lib/inspo-audio-source";
import { getPresignedUrl } from "@/lib/s3";
import { DNA_MODEL_MAX_TRACKS, DNA_MODEL_MIN_TRACKS } from "./model-spec";

/**
 * APIMart fetches the reference clips itself, so every clip has to be a public
 * URL for the whole training run. The browser never sees these URLs and the
 * model needs nothing after training, but 7 days is the SigV4 maximum and the
 * cheapest way to survive a slow run plus a retry. Same pattern and TTL as the
 * inspiration references (generationService's INSPO_AUDIO_URL_TTL_SECONDS).
 */
export const DNA_MODEL_AUDIO_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Turns the picked track ids into the `audio_urls` array for `createModel`.
 *
 * Validation is strict on purpose: APIMart fails the whole (paid) training run
 * when one file is unreachable or not audio, so a track that is not finished or
 * has no stored audio is rejected here instead of silently dropping the quality
 * of the model. Order is preserved — the user picked it — and duplicates collapse.
 */
export async function resolveDnaModelAudioUrls(userId: string, trackIds: string[]): Promise<string[]> {
  const ids = [...new Set(trackIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];

  if (ids.length < DNA_MODEL_MIN_TRACKS) {
    throw new Error(`Pick at least ${DNA_MODEL_MIN_TRACKS} tracks — APIMart needs 6 to 24 reference clips`);
  }
  if (ids.length > DNA_MODEL_MAX_TRACKS) {
    throw new Error(`Pick at most ${DNA_MODEL_MAX_TRACKS} tracks — APIMart accepts 6 to 24 reference clips`);
  }

  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      status: tracks.status,
      s3Key: tracks.s3Key,
      s3KeyHd: tracks.s3KeyHd,
      s3KeyMp3: tracks.s3KeyMp3,
      s3KeyOgg: tracks.s3KeyOgg,
      format: tracks.format,
      formatHd: tracks.formatHd,
    })
    .from(tracks)
    .where(and(eq(tracks.userId, userId), inArray(tracks.id, ids)));
  const byId = new Map(rows.map((row) => [row.id, row]));

  const audioUrls: string[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    const label = row?.title?.trim() || "untitled";
    if (!row || row.status !== "done") {
      throw new Error(`Track "${label}" has no finished audio yet`);
    }
    // MP3 keeps the uploaded files as small as the track allows and is the
    // container APIMart recommends; a WAV-only track is transcoded once and the
    // result is cached on the track by ensureInspoMp3Source.
    const key = await ensureInspoMp3Source(userId, row);
    audioUrls.push(await getPresignedUrl(key, DNA_MODEL_AUDIO_URL_TTL_SECONDS));
  }

  return audioUrls;
}
