import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getSetting(key: string): Promise<string> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  if (result.length > 0 && result[0].value) {
    return result[0].value;
  }
  return "";
}


export async function getWebhookUrl(provider: string): Promise<string> {
  const key = `${provider.toUpperCase()}_WEBHOOK_URL`;
  let url = await getSetting(key);

  if (!url && process.env[key]) {
    url = process.env[key] || "";
  }

  if (url) {
    // Auto-correct the known singular/plural typo
    url = url.replace(/\/api\/webhook\//g, "/api/webhooks/");
    // If already has ?secret= param, return as-is
    if (url.includes("?secret=")) return url;
    // Append secret from env
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) return `${url}?secret=${encodeURIComponent(secret)}`;
    return url;
  }

  // Auto-derive from APP_URL
  const appUrl = await getSetting("APP_URL");
  if (appUrl) {
    const base = `${appUrl.replace(/\/$/, "")}/api/webhooks/${provider.toLowerCase()}`;
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) return `${base}?secret=${encodeURIComponent(secret)}`;
    return base;
  }

  // Neither explicit URL nor APP_URL is set — this will break generation
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
  }

  // Check S3 keys (required for uploads)
  // Fall back to env variables if not set in database
  const s3Endpoint = await getSetting("S3_ENDPOINT") || process.env.S3_ENDPOINT;
  const s3AccessKey = await getSetting("S3_ACCESS_KEY") || process.env.S3_ACCESS_KEY;
  const s3SecretKey = await getSetting("S3_SECRET_KEY") || process.env.S3_SECRET_KEY;
  const s3Bucket = await getSetting("S3_BUCKET") || process.env.S3_BUCKET || "sonara-tracks";
  
  if (!s3Endpoint) missing.push("S3_ENDPOINT");
  if (!s3AccessKey) missing.push("S3_ACCESS_KEY");
  if (!s3SecretKey) missing.push("S3_SECRET_KEY");

  return {
    valid: missing.length === 0,
    missing,
  };
}
