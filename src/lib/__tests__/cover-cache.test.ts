import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

// COVER_CACHE_DIR is read lazily inside the module, but set it before the
// import anyway so nothing can touch the real cache directory.
const cacheDir = path.join(os.tmpdir(), `melodiq-cover-cache-test-${process.pid}`);
process.env.COVER_CACHE_DIR = cacheDir;

const { getCachedCover, coverResponse, isCoverCached, getCoverCacheStats, clearCoverCache } =
  await import("@/lib/cover-cache");

// Mirrors the module's own key -> filename derivation.
function cacheFilename(s3Key: string) {
  const hash = crypto.createHash("sha256").update(s3Key).digest("hex").slice(0, 16);
  return `${hash}.webp`;
}

const S3_KEY = "tracks/abc/cover.webp";
const CONTENT = Buffer.from("fake-webp-bytes-0123456789");

describe("cover-cache", () => {
  // Generous timeouts: the hooks themselves are two fs calls, but this suite's
  // jsdom setup is slow enough to blow the 10s default when all files run together.
  beforeAll(async () => {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(path.join(cacheDir, cacheFilename(S3_KEY)), CONTENT);
  }, 30_000);

  afterAll(async () => {
    await fs.rm(cacheDir, { recursive: true, force: true });
  }, 30_000);

  it("reports a seeded cover as cached", async () => {
    expect(await isCoverCached(S3_KEY)).toBe(true);
    expect(await isCoverCached("tracks/missing/cover.webp")).toBe(false);
  });

  it("serves a cache hit as a stream without reading it into a buffer first", async () => {
    const cover = await getCachedCover(S3_KEY);

    expect(cover.cached).toBe(true);
    expect(cover.size).toBe(CONTENT.length);
    expect(cover.contentType).toBe("image/webp");
    expect(cover.body).toBeInstanceOf(ReadableStream);

    const bytes = Buffer.from(await new Response(cover.body).arrayBuffer());
    expect(bytes.equals(CONTENT)).toBe(true);
  });

  it("builds a 200 response with the right headers", async () => {
    const cover = await getCachedCover(S3_KEY);
    const res = coverResponse(new Request("http://localhost/cover"), cover, "private");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("content-length")).toBe(String(CONTENT.length));
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400, immutable");
    expect(res.headers.get("etag")).toBeTruthy();
    expect(res.headers.get("x-cover-cache")).toBe("hit");
  });

  it("answers a matching If-None-Match with a bodyless 304", async () => {
    const first = await getCachedCover(S3_KEY);
    const etag = first.etag;

    const second = await getCachedCover(S3_KEY);
    const res = coverResponse(
      new Request("http://localhost/cover", { headers: { "if-none-match": etag } }),
      second,
      "public",
    );

    expect(res.status).toBe(304);
    expect(res.body).toBeNull();
    expect(res.headers.get("etag")).toBe(etag);
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400, immutable");
  });

  it("reports cache stats and clears the directory", async () => {
    const stats = await getCoverCacheStats();
    expect(stats.fileCount).toBeGreaterThanOrEqual(1);
    expect(stats.totalBytes).toBeGreaterThanOrEqual(CONTENT.length);

    const { deletedCount } = await clearCoverCache();
    expect(deletedCount).toBeGreaterThanOrEqual(1);
    expect(await isCoverCached(S3_KEY)).toBe(false);
  });
});
