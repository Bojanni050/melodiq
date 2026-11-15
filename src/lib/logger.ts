import { db } from "@/db";
import { apiLogs } from "@/db/schema";
import { getSetting } from "@/lib/settings";
import { formatLlmUsage, type LlmUsage } from "@/lib/llm-usage";

const MAX_LOG_CHARS = 4000;

function truncateForConsole(value: string) {
  if (value.length <= MAX_LOG_CHARS) return value;
  return `${value.slice(0, MAX_LOG_CHARS)}... [truncated ${value.length - MAX_LOG_CHARS} chars]`;
}

export async function logApi({
  userId,
  type,
  provider,
  endpoint,
  request,
  response,
  statusCode,
  duration,
  usage,
}: {
  userId?: string | null;
  type: string;
  provider: string;
  endpoint: string;
  request: string;
  response?: string;
  statusCode?: number;
  duration?: number;
  /**
   * Token/cost accounting for LLM calls (see src/lib/llm-usage.ts). Stored in
   * its own columns so spend per purpose/endpoint can be queried directly
   * instead of being parsed back out of the response text.
   */
  usage?: LlmUsage | null;
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
      promptTokens: usage?.promptTokens ?? null,
      completionTokens: usage?.completionTokens ?? null,
      cachedTokens: usage?.cachedTokens ?? null,
      costUsd: usage?.costUsd ?? null,
    });

    const requestLog = truncateForConsole(request || "");
    const responseLog = truncateForConsole(response || "");
    const usageLog = formatLlmUsage(usage);
    console.log(
      `[api-log] ${type.toUpperCase()} ${provider} ${endpoint} status=${statusCode ?? "n/a"} duration=${duration ?? "n/a"}ms` +
        (usageLog ? ` usage: ${usageLog}` : "") +
        `\n  sent: ${requestLog || "(empty)"}\n  received: ${responseLog || "(empty)"}`
    );
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
}

