import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

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
