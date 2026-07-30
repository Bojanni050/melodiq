import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { getPresignedUrl } from "@/lib/s3";

/**
 * Disk-based audio cache.
 *
 * Cache directory: configured via env CACHE_DIR or defaults to "/data/audio-cache".
 * In production (Docker), mount a volume there so cached audio survives restarts.
 *
 * Flow:
 *   1. First play of a track → stream from S3 to the client and to disk at
 *      the same time (tee'd), so playback isn't blocked on a full download
 *   2. Subsequent plays     → stream directly from disk (no S3 request)
 */

function getCacheDir(): string {
  if (process.env.CACHE_DIR) return process.env.CACHE_DIR;
  if (process.platform === "win32") {
    return path.join(process.cwd(), "data", "audio-cache");
  }
  return "/data/audio-cache";
}


function ensureCacheDir(): void {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Derive a safe unique filename from an S3 key. */
function cacheFilename(s3Key: string, format: string): string {
  const hash = crypto.createHash("sha256").update(s3Key).digest("hex").slice(0, 16);
  return `${hash}.${format}`;
}

function cachePath(s3Key: string, format: string): string {
  return path.join(getCacheDir(), cacheFilename(s3Key, format));
}

/** Check if an audio file is already cached on disk. */
export function isCached(s3Key: string, format: string): boolean {
  return fs.existsSync(cachePath(s3Key, format));
}

/**
 * Get a readable stream for a cached (or freshly cached) audio file.
 *
 * If the file is already cached, it's served straight from disk. Otherwise
 * the S3 response body is tee'd: one branch streams to the caller right
 * away, the other is written to disk in the background so the *next* play
 * is served from disk. The first play is therefore no longer blocked on a
 * full S3 download + disk write before any bytes reach the client.
 *
 * `size` is the total byte length of the audio (from disk stats when
 * cached, from the S3 response's Content-Length otherwise) — use it for the
 * response's Content-Length instead of `fs.statSync`, since the on-disk
 * file may still be mid-write when `cached` is false.
 */
export async function getCachedAudioStream(
  s3Key: string,
  format: string,
): Promise<{ filePath: string; stream: Readable; cached: boolean; size: number }> {
  ensureCacheDir();
  const dest = cachePath(s3Key, format);

  if (isCached(s3Key, format)) {
    const stat = fs.statSync(dest);
    return { filePath: dest, stream: fs.createReadStream(dest), cached: true, size: stat.size };
  }

  const presignedUrl = await getPresignedUrl(s3Key);
  const response = await fetch(presignedUrl);

  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to fetch from S3: ${response.status} ${response.statusText}`,
    );
  }

  const size = Number(response.headers.get("content-length") || 0);
  const [clientSide, diskSide] = response.body.tee();

  // Write atomically: write to a temp file then rename, in the background.
  const tmp = dest + ".tmp";
  void pipeline(Readable.fromWeb(diskSide as any), fs.createWriteStream(tmp))
    .then(() => fs.renameSync(tmp, dest))
    .catch((err) => {
      console.error(`[audio-cache] background caching failed for ${s3Key}:`, err);
      try { fs.unlinkSync(tmp); } catch {}
    });

  return { filePath: dest, stream: Readable.fromWeb(clientSide as any), cached: false, size };
}

/**
 * Get the file stats for a cached audio file.
 * Throws if the file is not cached.
 */
export function getCachedFileStats(s3Key: string, format: string): fs.Stats {
  return fs.statSync(cachePath(s3Key, format));
}

/**
 * Get content type for a format string.
 */
export function getContentType(format: string): string {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    webm: "audio/webm",
  };
  return map[format.toLowerCase()] || "audio/mpeg";
}

/**
 * Clear the entire audio cache — deletes all cached files.
 */
export function clearCache(): { deletedCount: number } {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) return { deletedCount: 0 };

  const entries = fs.readdirSync(dir);
  let deletedCount = 0;
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    try {
      fs.unlinkSync(fullPath);
      deletedCount++;
    } catch {
      // skip files we can't delete
    }
  }
  return { deletedCount };
}

/**
 * Get disk usage summary for the cache.
 */
export function getCacheStats(): {
  fileCount: number;
  totalBytes: number;
  cacheDir: string;
} {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) return { fileCount: 0, totalBytes: 0, cacheDir: dir };

  const entries = fs.readdirSync(dir);
  let totalBytes = 0;
  for (const entry of entries) {
    try {
      const stat = fs.statSync(path.join(dir, entry));
      if (stat.isFile()) totalBytes += stat.size;
    } catch {
      // skip
    }
  }
  return { fileCount: entries.length, totalBytes, cacheDir: dir };
}
