import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
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
 *
 * Everything on the request path is async and streamed. A cover grid fires
 * dozens of these concurrently, and the previous readFileSync/existsSync
 * version blocked the event loop once per image — which also stalled audio
 * streaming served by the same process.
 */

function getCacheDir(): string {
  if (process.env.COVER_CACHE_DIR) return process.env.COVER_CACHE_DIR;
  if (process.platform === "win32") {
    return path.join(process.cwd(), "data", "cover-cache");
  }
  return "/data/cover-cache";
}

let cacheDirReady: Promise<void> | null = null;

function ensureCacheDir(): Promise<void> {
  // mkdir -p is idempotent, so this only ever needs to run once per process.
  if (!cacheDirReady) {
    cacheDirReady = fsp.mkdir(getCacheDir(), { recursive: true }).then(
      () => undefined,
      (e) => {
        cacheDirReady = null;
        throw e;
      }
    );
  }
  return cacheDirReady;
}

/** Derive a safe unique filename from an S3 key. */
function cacheFilename(s3Key: string): string {
  const hash = crypto.createHash("sha256").update(s3Key).digest("hex").slice(0, 16);
  const ext = s3Key.endsWith(".avif") ? "avif" : s3Key.endsWith(".webp") ? "webp" : s3Key.endsWith(".png") ? "png" : s3Key.endsWith(".jpg") || s3Key.endsWith(".jpeg") ? "jpg" : "webp";
  return `${hash}.${ext}`;
}

function cachePath(s3Key: string): string {
  return path.join(getCacheDir(), cacheFilename(s3Key));
}

function contentTypeFor(filePath: string): string {
  return filePath.endsWith(".avif")
    ? "image/avif"
    : filePath.endsWith(".webp")
    ? "image/webp"
    : filePath.endsWith(".png")
    ? "image/png"
    : "image/jpeg";
}

/** Check if a cover file is already cached on disk. */
export async function isCoverCached(s3Key: string): Promise<boolean> {
  try {
    await fsp.access(cachePath(s3Key));
    return true;
  } catch {
    return false;
  }
}

export type CachedCover = {
  /** Web stream of the image bytes — hand straight to a Response. */
  body: ReadableStream<Uint8Array>;
  size: number;
  cached: boolean;
  contentType: string;
  etag: string;
};

/**
 * Get a cached (or freshly cached) cover image as a stream.
 *
 * If the file isn't cached yet it is downloaded from S3 first and written
 * to the cache directory. Subsequent calls serve directly from disk.
 */
export async function getCachedCover(s3Key: string): Promise<CachedCover> {
  await ensureCacheDir();
  const dest = cachePath(s3Key);
  const contentType = contentTypeFor(dest);

  let stat: import("fs").Stats | null = null;
  try {
    stat = await fsp.stat(dest);
  } catch {
    stat = null;
  }

  if (stat) {
    return {
      body: Readable.toWeb(fs.createReadStream(dest)) as ReadableStream<Uint8Array>,
      size: stat.size,
      cached: true,
      contentType,
      etag: `"${cacheFilename(s3Key)}-${stat.size}"`,
    };
  }

  const presignedUrl = await getPresignedUrl(s3Key);
  const response = await fetch(presignedUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch cover from S3: ${response.status} ${response.statusText}`);
  }

  // Covers are small and a miss happens once per image, so buffering the
  // download keeps the write-then-serve path simple. The write is async and
  // the buffer is handed to the client as a stream.
  const buffer = Buffer.from(await response.arrayBuffer());

  // Write atomically: write to a unique temp file then rename. The suffix
  // keeps two concurrent misses for the same key from clobbering each other's
  // partial file (rename itself is atomic, so the last one simply wins).
  const tmp = `${dest}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  try {
    await fsp.writeFile(tmp, buffer);
    await fsp.rename(tmp, dest);
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    // A failed cache write must not fail the request — serve the bytes anyway.
    console.warn(`[cover-cache] failed to cache ${s3Key}:`, e);
  }

  return {
    body: Readable.toWeb(Readable.from(buffer)) as ReadableStream<Uint8Array>,
    size: buffer.length,
    cached: false,
    contentType,
    etag: `"${cacheFilename(s3Key)}-${buffer.length}"`,
  };
}

/**
 * Build the HTTP response for a cover, including conditional-request handling.
 * Shared by every cover route so headers stay consistent.
 */
export function coverResponse(
  request: Request,
  cover: CachedCover,
  visibility: "public" | "private",
): Response {
  const headers: Record<string, string> = {
    "Content-Type": cover.contentType,
    "Cache-Control": `${visibility}, max-age=86400, immutable`,
    ETag: cover.etag,
    "X-Cover-Cache": cover.cached ? "hit" : "miss",
  };

  if (request.headers.get("if-none-match") === cover.etag) {
    cover.body.cancel().catch(() => {});
    return new Response(null, { status: 304, headers });
  }

  return new Response(cover.body, {
    status: 200,
    headers: { ...headers, "Content-Length": String(cover.size) },
  });
}

/**
 * Clear the entire cover cache — deletes all cached files.
 */
export async function clearCoverCache(): Promise<{ deletedCount: number }> {
  const dir = getCacheDir();
  let entries: string[];
  try {
    entries = await fsp.readdir(dir);
  } catch {
    return { deletedCount: 0 };
  }

  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        await fsp.unlink(path.join(dir, entry));
        return 1 as number;
      } catch {
        return 0 as number; // skip files we can't delete
      }
    })
  );

  return { deletedCount: results.reduce((sum, n) => sum + n, 0) };
}

/**
 * Get disk usage summary for the cover cache.
 */
export async function getCoverCacheStats(): Promise<{
  fileCount: number;
  totalBytes: number;
  cacheDir: string;
}> {
  const dir = getCacheDir();
  let entries: string[];
  try {
    entries = await fsp.readdir(dir);
  } catch {
    return { fileCount: 0, totalBytes: 0, cacheDir: dir };
  }

  const sizes = await Promise.all(
    entries.map(async (entry) => {
      try {
        const stat = await fsp.stat(path.join(dir, entry));
        return stat.isFile() ? stat.size : 0;
      } catch {
        return 0;
      }
    })
  );

  return {
    fileCount: entries.length,
    totalBytes: sizes.reduce((sum, size) => sum + size, 0),
    cacheDir: dir,
  };
}
