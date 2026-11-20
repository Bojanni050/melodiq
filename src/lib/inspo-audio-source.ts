import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";
import { transcodeToMp3 } from "@/lib/transcode";
import { getBestSourceForOggConversion, type TrackAudioFields } from "@/lib/audio-format";

/** Upload pipeline converts to MP3 at 320kbps; inspiration references match that. */
const INSPO_MP3_BITRATE_KBPS = 320;

export interface InspoAudioSource {
  s3Key: string;
  format: string;
  /** True when the key already points at an MP3 file, so no transcode is needed. */
  alreadyMp3: boolean;
}

export interface InspoTrackFields extends TrackAudioFields {
  id: string;
  title?: string | null;
}

/**
 * Picks the best file to feed the inspiration reference with. The result is
 * only guaranteed to be an MP3 when `alreadyMp3` is true — otherwise the
 * caller has to transcode it.
 *
 * Order: cached MP3 → an original MP3 file → WAV/FLAC (best quality first) →
 * OGG fallback → any remaining key. OGG/WAV/FLAC can never be sent as-is,
 * because the inspiration gateways expect MP3.
 */
export function pickInspoAudioSource(track: TrackAudioFields): InspoAudioSource | null {
  // Cached MP3 derivative (written by the upload pipeline or an earlier
  // inspiration request) is always preferred: it is the cheapest path.
  if (track.s3KeyMp3) {
    return { s3Key: track.s3KeyMp3, format: "mp3", alreadyMp3: true };
  }

  // The original upload can itself be an MP3, in which case S3 already holds
  // something we can reuse without a lossy re-encode.
  if ((track.format === "mp3" || track.formatHd === "mp3") && track.s3Key) {
    return { s3Key: track.s3Key, format: "mp3", alreadyMp3: true };
  }
  if (track.formatHd === "mp3" && track.s3KeyHd) {
    return { s3Key: track.s3KeyHd, format: "mp3", alreadyMp3: true };
  }

  // WAV/FLAC/MP3 preference used elsewhere in the app (skips pure-OGG tracks).
  const best = getBestSourceForOggConversion(track);
  if (best) {
    return {
      s3Key: best.s3Key,
      format: best.format,
      alreadyMp3: best.format === "mp3",
    };
  }

  // Tracks that only exist as OGG still need a transcode, but must not be
  // rejected just because there is no other source.
  if (track.s3KeyOgg) {
    return { s3Key: track.s3KeyOgg, format: "ogg", alreadyMp3: false };
  }
  if (track.format === "ogg" && track.s3Key) {
    return { s3Key: track.s3Key, format: "ogg", alreadyMp3: false };
  }
  if (track.formatHd === "ogg" && track.s3KeyHd) {
    return { s3Key: track.s3KeyHd, format: "ogg", alreadyMp3: false };
  }

  // Last resort: an extension-less key we have not classified. Still better to
  // try transcoding it than to refuse the track outright.
  if (track.s3Key) {
    return { s3Key: track.s3Key, format: track.format ?? "unknown", alreadyMp3: false };
  }
  if (track.s3KeyHd) {
    return { s3Key: track.s3KeyHd, format: track.formatHd ?? "unknown", alreadyMp3: false };
  }

  return null;
}

/**
 * Resolves a track to an S3 key that provably holds an MP3, for the
 * inspiration reference (`audio_urls`) sent to PoYo and APIMart.
 *
 * MP3 is not optional on that path: those gateways reject or mis-handle other
 * containers, and the same reference is reused by every generation. So when a
 * track only has WAV/FLAC/OGG audio, it is downloaded, transcoded to MP3 at
 * 320kbps and uploaded to `tracks/{id}/audio.mp3`; `tracks.s3_key_mp3` is
 * cached so later generations skip the transcode entirely.
 *
 * Throws when the track has no audio or when the transcode fails — sending a
 * non-MP3 file instead would silently produce a broken generation.
 */
export async function ensureInspoMp3Source(userId: string, track: InspoTrackFields): Promise<string> {
  const label = track.title?.trim() || track.id;
  const source = pickInspoAudioSource(track);

  if (!source) {
    throw new Error(`Inspiration track "${label}" has no audio yet`);
  }

  if (source.alreadyMp3) {
    return source.s3Key;
  }

  const sourceBuffer = await downloadFromS3(source.s3Key);
  if (!sourceBuffer?.length) {
    throw new Error(`Inspiration track "${label}" has no audio yet`);
  }

  let mp3Buffer: Buffer;
  try {
    mp3Buffer = await transcodeToMp3(sourceBuffer, INSPO_MP3_BITRATE_KBPS);
  } catch (error) {
    console.error(`[inspo-audio] track ${track.id}: mp3 transcode failed for ${source.s3Key}:`, error);
    throw new Error(`Could not convert inspiration track "${label}" to MP3`);
  }

  const mp3Key = `tracks/${track.id}/audio.mp3`;
  await uploadToS3(mp3Key, mp3Buffer, "audio/mpeg");
  await db
    .update(tracks)
    .set({ s3KeyMp3: mp3Key })
    .where(and(eq(tracks.id, track.id), eq(tracks.userId, userId)));

  console.info(
    `[inspo-audio] track ${track.id}: transcoded ${source.format} (${source.s3Key}, ${sourceBuffer.length} bytes) to mp3 ${mp3Key} (${mp3Buffer.length} bytes)`
  );

  return mp3Key;
}
