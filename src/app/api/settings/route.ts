import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { access, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

async function getDirectorySizeBytes(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let total = 0;

    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await getDirectorySizeBytes(entryPath);
      } else if (entry.isFile()) {
        const info = await stat(entryPath);
        total += info.size;
      }
    }

    return total;
  } catch {
    return 0;
  }
}

async function getDiskCacheSizeBytes(): Promise<number> {
  const cachePath = "/data/audio-cache";

  try {
    await access(cachePath);
    return await getDirectorySizeBytes(cachePath);
  } catch {
    return 0;
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

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

  settingsMap.DISK_CACHE_SIZE_BYTES = String(await getDiskCacheSizeBytes());

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
