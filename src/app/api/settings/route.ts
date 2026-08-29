import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { access, readdir, stat } from "node:fs/promises";
import { ffmpegAvailable } from "@/lib/wav-to-flac";
import { join } from "node:path";

export const dynamic = "force-dynamic";

async function getDirectorySizeBytes(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    // Fan the entries out instead of awaiting one stat() at a time — a warm
    // cache holds thousands of files and the sequential version turned this
    // into a multi-second walk.
    const sizes = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(dirPath, entry.name);
        if (entry.isDirectory()) return getDirectorySizeBytes(entryPath);
        if (!entry.isFile()) return 0;
        try {
          const info = await stat(entryPath);
          return info.size;
        } catch {
          return 0;
        }
      })
    );

    return sizes.reduce((total, size) => total + size, 0);
  } catch {
    return 0;
  }
}

// Walking the audio/cover caches costs one stat() per cached file, so the
// result is memoised: repeat visits to the settings screen reuse it, and
// every other caller skips the walk entirely (see `stats` below).
const DISK_CACHE_SIZE_TTL_MS = 60_000;
let diskCacheSizeCache: { bytes: number; expiresAt: number } | null = null;
let diskCacheSizeInFlight: Promise<number> | null = null;

async function computeDiskCacheSizeBytes(): Promise<number> {
  const totals = await Promise.all(
    ["/data/audio-cache", "/data/cover-cache"].map(async (dir) => {
      try {
        await access(dir);
      } catch {
        return 0; // dir doesn't exist yet
      }
      return getDirectorySizeBytes(dir);
    })
  );
  return totals.reduce((total, size) => total + size, 0);
}

async function getDiskCacheSizeBytes(): Promise<number> {
  if (diskCacheSizeCache && diskCacheSizeCache.expiresAt > Date.now()) {
    return diskCacheSizeCache.bytes;
  }
  // Collapse concurrent requests onto a single walk.
  if (!diskCacheSizeInFlight) {
    diskCacheSizeInFlight = computeDiskCacheSizeBytes()
      .then((bytes) => {
        diskCacheSizeCache = { bytes, expiresAt: Date.now() + DISK_CACHE_SIZE_TTL_MS };
        return bytes;
      })
      .finally(() => {
        diskCacheSizeInFlight = null;
      });
  }
  return diskCacheSizeInFlight;
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Only the settings screen renders the cache-size readout, and it is the
  // one caller that asks for it. Every other caller (notably TrackCard, which
  // reads a single feature flag from here) skips the disk walk entirely.
  const wantsStats = new URL(request.url).searchParams.get("stats") === "1";

  const allSettings = await db.select().from(settings);
  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    settingsMap[s.key] = s.value;
  }

  // Auto-populate APP_URL from env if not stored in DB yet
  if (!settingsMap.APP_URL && process.env.NEXT_PUBLIC_APP_URL) {
    settingsMap.APP_URL = process.env.NEXT_PUBLIC_APP_URL;
  }

  if (!settingsMap.POYO_WAV_WEBHOOK_URL && process.env.POYO_WAV_WEBHOOK_URL) {
    settingsMap.POYO_WAV_WEBHOOK_URL = process.env.POYO_WAV_WEBHOOK_URL;
  }

  if (wantsStats) {
    settingsMap.DISK_CACHE_SIZE_BYTES = String(await getDiskCacheSizeBytes());
  }
  settingsMap.FFMPEG_AVAILABLE = ffmpegAvailable() ? "true" : "false";

  return NextResponse.json(settingsMap);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { key, value } = body;

  if (!key || typeof value !== "string") {
    return NextResponse.json({ error: "Key and value are required" }, { status: 400 });
  }

  // Auto-correct webhook URL typo before saving
  let sanitizedValue = value;
  if (key.endsWith("_WEBHOOK_URL") && value.includes("/api/webhook/")) {
    sanitizedValue = value.replace(/\/api\/webhook\//g, "/api/webhooks/");
    console.warn(`[settings] Auto-corrected webhook URL for ${key}: /api/webhook/ → /api/webhooks/`);
  }

  const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);

  if (existing.length > 0) {
    await db.update(settings).set({ value: sanitizedValue }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value: sanitizedValue });
  }

  return NextResponse.json({ success: true });
}
