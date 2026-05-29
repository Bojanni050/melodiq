/**
 * Backfill script: convert existing cover art to WebP and generate 50x50 thumbnails.
 *
 * Run with:
 *   npx tsx scripts/backfill-cover-webp.ts
 *
 * Requires .env.production (or .env) to be present with S3 and DATABASE_URL set.
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import path from "path";

// Load Next.js env files (.env, .env.production, etc.)
loadEnvConfig(path.resolve(process.cwd()));

import { db } from "@/db";
import { tracks } from "@/db/schema";
import { isNotNull, isNull, and } from "drizzle-orm";
import { getPresignedUrl, uploadToS3 } from "@/lib/s3";
import sharp from "sharp";
import { eq } from "drizzle-orm";

const BATCH_SIZE = 10;
const CONCURRENCY = 3;

async function processTrack(track: { id: string; s3KeyCover: string }) {
  try {
    // Download existing cover from S3
    const url = await getPresignedUrl(track.s3KeyCover);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`S3 fetch failed: ${res.status}`);
    const rawBuffer = Buffer.from(await res.arrayBuffer());

    // Convert to WebP + generate thumbnail in parallel
    const [webpBuffer, thumbBuffer] = await Promise.all([
      sharp(rawBuffer).webp({ quality: 85 }).toBuffer(),
      sharp(rawBuffer).resize(50, 50, { fit: "cover" }).webp({ quality: 80 }).toBuffer(),
    ]);

    const s3KeyCover = `tracks/${track.id}/cover.webp`;
    const s3KeyCoverThumb = `tracks/${track.id}/cover_thumb.webp`;

    // Upload both
    await Promise.all([
      uploadToS3(s3KeyCover, webpBuffer, "image/webp"),
      uploadToS3(s3KeyCoverThumb, thumbBuffer, "image/webp"),
    ]);

    // Update DB
    await db
      .update(tracks)
      .set({ s3KeyCover, s3KeyCoverThumb })
      .where(eq(tracks.id, track.id));

    return { id: track.id, status: "ok" as const };
  } catch (err: any) {
    return { id: track.id, status: "error" as const, error: err?.message ?? String(err) };
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function main() {
  console.log("🔍 Fetching tracks with cover art but no thumbnail...");

  const pending = await db
    .select({ id: tracks.id, s3KeyCover: tracks.s3KeyCover })
    .from(tracks)
    .where(and(isNotNull(tracks.s3KeyCover), isNull(tracks.s3KeyCoverThumb)));

  console.log(`📦 Found ${pending.length} tracks to backfill.\n`);

  if (pending.length === 0) {
    console.log("✅ Nothing to do.");
    return;
  }

  let done = 0;
  let errors = 0;

  const validTracks = pending.filter((t): t is { id: string; s3KeyCover: string } =>
    t.s3KeyCover !== null
  );

  const results = await runWithConcurrency(validTracks, CONCURRENCY, async (track) => {
    const result = await processTrack(track);
    done++;
    if (result.status === "ok") {
      process.stdout.write(`✓ [${done}/${validTracks.length}] ${track.id}\n`);
    } else {
      errors++;
      process.stdout.write(`✗ [${done}/${validTracks.length}] ${track.id} — ${result.error}\n`);
    }
    return result;
  });

  console.log(`\n✅ Done. ${done - errors} converted, ${errors} errors.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
