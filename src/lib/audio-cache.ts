import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getPresignedUrl } from "@/lib/s3";

/**
 * Disk-based audio cache.
 *
 * Cache directory: configured via env CACHE_DIR or defaults to "/data/audio-cache".
 * In production (Docker), mount a volume there so cached audio survives restarts.
 *
 * Flow:
 *   1. First play of a track → download from S3 → write to disk → stream
 *   2. Subsequent plays     → stream directly from disk (no S3 request)
 */

function getCacheDir(): string {
  return process.env.CACHE_DIR || "/data/audio-cache";
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
 * If the file isn't cached yet it is downloaded from S3 first and written
 * to the cache directory. Subsequent calls serve directly from disk.
 *
 * Returns the local file path so the caller can create a proper response
 * with content-type and content-length headers.
 */
export async function getCachedAudioStream(
  s3Key: string,
  format: string,
): Promise<{ filePath: string; stream: fs.ReadStream }> {
  ensureCacheDir();
  const dest = cachePath(s3Key, format);

  if (!isCached(s3Key, format)) {
    // Download from S3 and cache locally
    const presignedUrl = await getPresignedUrl(s3Key);
    const response = await fetch(presignedUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from S3: ${response.status} ${response.statusText}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Write atomically: write to a temp file then rename
    const tmp = dest + ".tmp";
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, dest);
  }

  const stat = fs.statSync(dest);
  const stream = fs.createReadStream(dest);

  return { filePath: dest, stream };
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
