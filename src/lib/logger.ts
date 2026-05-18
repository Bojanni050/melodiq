import { db } from "@/db";
import { apiLogs } from "@/db/schema";
import { getSetting } from "@/lib/settings";

export async function logApi({
  userId,
  type,
  provider,
  endpoint,
  request,
  response,
  statusCode,
  duration,
}: {
  userId?: string | null;
  type: string;
  provider: string;
  endpoint: string;
  request: string;
  response?: string;
  statusCode?: number;
  duration?: number;
}) {
  const logging = await getSetting("ENABLE_API_LOGGING");
  const enabled = logging
    ? logging === "true"
    : process.env.ENABLE_API_LOGGING === "true";
  if (!enabled) return;
  try {
    await db.insert(apiLogs).values({
      userId: userId || null,
      type,
      provider,
      endpoint,
      request,
      response: response || null,
      statusCode: statusCode || null,
      duration: duration || null,
    });
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
}
