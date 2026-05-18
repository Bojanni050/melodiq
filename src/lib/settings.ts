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
