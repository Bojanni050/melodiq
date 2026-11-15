import { db } from "@/db";
import { settings } from "@/db/schema";

// Every getSetting() used to be its own SELECT. One LLM call resolves a dozen
// settings (and the timecoded AI-edit resolves ~25 on top of that), so the round
// trips — not the model — dominated those requests. The whole table is cached
// in-process instead: it is small (one row per key) and the only writers are
// POST /api/settings and the timecoded settings route, both of which call
// invalidateSettingsCache(). The TTL bounds anything that writes around them
// (scripts, manual SQL).
const SETTINGS_CACHE_TTL_MS = 30_000;
let cachedValues: Map<string, string> | null = null;
let cachedAt = 0;
let inFlight: Promise<Map<string, string>> | null = null;

/** Drops the cache. Call after any write to the settings table. */
export function invalidateSettingsCache(): void {
  cachedValues = null;
  cachedAt = 0;
}

async function queryAllSettings(): Promise<Map<string, string>> {
  const rows = await db.select().from(settings);
  const values = new Map<string, string>();
  for (const row of rows) values.set(row.key, row.value ?? "");
  cachedValues = values;
  cachedAt = Date.now();
  return values;
}

async function loadAllSettings(): Promise<Map<string, string>> {
  if (cachedValues && Date.now() - cachedAt < SETTINGS_CACHE_TTL_MS) {
    return cachedValues;
  }
  // Collapse concurrent requests onto a single query (same pattern as the
  // disk-cache size memo in src/app/api/settings/route.ts).
  if (!inFlight) {
    inFlight = queryAllSettings().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export async function getSetting(key: string): Promise<string> {
  const values = await loadAllSettings();
  return values.get(key) ?? "";
}

function appendWebhookSecret(url: string): string {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return url;

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("secret")) {
      parsed.searchParams.set("secret", secret);
    }
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}secret=${encodeURIComponent(secret)}`;
  }
}

export async function getWebhookUrl(provider: string): Promise<string> {
  if (provider.toLowerCase() === "musicgpt") {
    const configured = await getSetting("MUSICGPT_WEBHOOK_URL");
    const explicit = configured || process.env.MUSICGPT_WEBHOOK_URL || "";
    if (explicit) {
      const normalized = explicit.replace(/\/api\/webhook\//g, "/api/webhooks/");
      return appendWebhookSecret(normalized);
    }

    const appUrl = await getSetting("APP_URL") || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      const base = `${appUrl.replace(/\/$/, "")}/api/webhooks/musicgpt`;
      return appendWebhookSecret(base);
    }

    throw new Error(
      "No webhook URL configured for provider \"musicgpt\". Set MUSICGPT_WEBHOOK_URL or APP_URL in the Settings page."
    );
  }

  const key = `${provider.toUpperCase()}_WEBHOOK_URL`;
  let url = await getSetting(key);

  if (!url && process.env[key]) {
    url = process.env[key] || "";
  }

  if (url) {
    // Auto-correct the known singular/plural typo
    url = url.replace(/\/api\/webhook\//g, "/api/webhooks/");
    return appendWebhookSecret(url);
  }

  // Auto-derive from APP_URL
  const appUrl = await getSetting("APP_URL") || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    const derivedPath = provider.toLowerCase().replace(/_/g, "-");
    const base = `${appUrl.replace(/\/$/, "")}/api/webhooks/${derivedPath}`;
    return appendWebhookSecret(base);
  }

  // Neither explicit URL nor APP_URL is set; this will break generation.
  throw new Error(
    `No webhook URL configured for provider "${provider}". ` +
    `Set ${key} or APP_URL in the Settings page.`
  );
}

export async function validateProviderApiKeys(provider: string): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];

  if (provider === "lyria") {
    const key = await getSetting("LYRIA_API_KEY");
    if (!key) missing.push("LYRIA_API_KEY");
  } else if (provider === "poyo") {
    const key = await getSetting("POYO_API_KEY");
    if (!key) missing.push("POYO_API_KEY");
  } else if (provider === "tempolor") {
    const key = await getSetting("TEMPOLOR_API_KEY");
    if (!key) missing.push("TEMPOLOR_API_KEY");
  } else if (provider === "musicgpt") {
    const key = await getSetting("MUSICGPT_API_KEY");
    if (!key) missing.push("MUSICGPT_API_KEY");
  } else if (provider === "mureka" || provider === "heartmula") {
    const key = await getSetting("WAVESPEED_API_KEY");
    if (!key) missing.push("WAVESPEED_API_KEY");
  } else if (provider === "minimax") {
    const usePoYo = await getSetting("MINIMAX_USE_POYO");
    if (usePoYo === "true") {
      const key = await getSetting("POYO_API_KEY");
      if (!key) missing.push("POYO_API_KEY");
    } else {
      const key = await getSetting("MINIMAX_API_KEY");
      if (!key) missing.push("MINIMAX_API_KEY");
    }
  } else if (provider === "apiframe") {
    const key = await getSetting("APIFRAME_API_KEY");
    if (!key) missing.push("APIFRAME_API_KEY");
  } else if (provider === "apimart") {
    const key = (await getSetting("APIMART_API_KEY")) || process.env.APIMART_API_KEY;
    if (!key) missing.push("APIMART_API_KEY");
  }

  // Check S3 keys (required for uploads)
  // Fall back to env variables if not set in database
  const s3Endpoint = await getSetting("S3_ENDPOINT") || process.env.S3_ENDPOINT;
  const s3AccessKey = await getSetting("S3_ACCESS_KEY") || process.env.S3_ACCESS_KEY;
  const s3SecretKey = await getSetting("S3_SECRET_KEY") || process.env.S3_SECRET_KEY;
  const s3Bucket = await getSetting("S3_BUCKET") || process.env.S3_BUCKET || "melodiq-tracks";
  
  if (!s3Endpoint) missing.push("S3_ENDPOINT");
  if (!s3AccessKey) missing.push("S3_ACCESS_KEY");
  if (!s3SecretKey) missing.push("S3_SECRET_KEY");

  return {
    valid: missing.length === 0,
    missing,
  };
}
