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
  const explicit = await getSetting(key);
  if (explicit) return explicit;
  // Auto-derive from APP_URL if not explicitly set
  const appUrl = await getSetting("APP_URL");
  if (appUrl) return `${appUrl.replace(/\/$/, "")}/api/webhooks/${provider.toLowerCase()}`;
  return "";
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
  }

  // Check S3 keys (required for uploads)
  const s3Endpoint = await getSetting("S3_ENDPOINT");
  const s3AccessKey = await getSetting("S3_ACCESS_KEY");
  const s3SecretKey = await getSetting("S3_SECRET_KEY");
  
  if (!s3Endpoint) missing.push("S3_ENDPOINT");
  if (!s3AccessKey) missing.push("S3_ACCESS_KEY");
  if (!s3SecretKey) missing.push("S3_SECRET_KEY");

  return {
    valid: missing.length === 0,
    missing,
  };
}
