import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getPresignedUrl } from "@/lib/s3";

/**
 * Disk-based cover art cache.
 *
 * Cache directory: configured via env COVER_CACHE_DIR or defaults to "/data/cover-cache".
 * In production (Docker), mount a volume there so cached covers survive restarts.
 *
 * Flow:
 *   1. First request for a cover → download from S3 → write to disk → serve
 *   2. Subsequent requests       → serve directly from disk (no S3 request)
 */

function getCacheDir(): string {
  return process.env.COVER_CACHE_DIR || "/data/cover-cache";
}

function ensureCacheDir(): void {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Derive a safe unique filename from an S3 key. */
function cacheFilename(s3Key: string): string {
  const hash = crypto.createHash("sha256").update(s3Key).digest("hex").slice(0, 16);
  const ext = s3Key.endsWith(".webp") ? "webp" : s3Key.endsWith(".jpg") ? "jpg" : "webp";
  return `${hash}.${ext}`;
}

function cachePath(s3Key: string): string {
  return path.join(getCacheDir(), cacheFilename(s3Key));
}

/** Check if a cover file is already cached on disk. */
export function isCoverCached(s3Key: string): boolean {
  return fs.existsSync(cachePath(s3Key));
}

/**
 * Get a cached (or freshly cached) cover image as a Buffer.
 *
 * If the file isn't cached yet it is downloaded from S3 first and written
 * to the cache directory. Subsequent calls serve directly from disk.
 */
export async function getCachedCover(
  s3Key: string,
): Promise<{ buffer: Buffer; cached: boolean; contentType: string }> {
  ensureCacheDir();
  const dest = cachePath(s3Key);
  const cached = isCoverCached(s3Key);

  if (!cached) {
    const presignedUrl = await getPresignedUrl(s3Key);
    const response = await fetch(presignedUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch cover from S3: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Write atomically: write to a temp file then rename
    const tmp = dest + ".tmp";
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, dest);
  }

  const buffer = fs.readFileSync(dest);
  const contentType = dest.endsWith(".webp") ? "image/webp" : "image/jpeg";

  return { buffer, cached, contentType };
}

/**
 * Clear the entire cover cache — deletes all cached files.
 */
export function clearCoverCache(): { deletedCount: number } {
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
 * Get disk usage summary for the cover cache.
 */
export function getCoverCacheStats(): {
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
