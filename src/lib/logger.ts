import { db } from "@/db";
import { apiLogs } from "@/db/schema";
import { getSetting } from "@/lib/settings";
import { formatLlmUsage, type LlmUsage } from "@/lib/llm-usage";

const MAX_LOG_CHARS = 4000;

function truncateForConsole(value: string) {
  if (value.length <= MAX_LOG_CHARS) return value;
  return `${value.slice(0, MAX_LOG_CHARS)}... [truncated ${value.length - MAX_LOG_CHARS} chars]`;
}

type ApiLogEntry = {
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
};

async function isSettingEnabled(key: string, envFallback: string) {
  const setting = await getSetting(key);
  return setting ? setting === "true" : process.env[envFallback] === "true";
}

/**
 * Shared insert + console output. Both logApi and logLlmCall funnel into this
 * after their own enable-gate. Never throws.
 */
async function insertApiLog(entry: ApiLogEntry) {
  try {
    await db.insert(apiLogs).values({
      userId: entry.userId || null,
      type: entry.type,
      provider: entry.provider,
      endpoint: entry.endpoint,
      request: entry.request,
      response: entry.response || null,
      statusCode: entry.statusCode || null,
      duration: entry.duration || null,
      promptTokens: entry.usage?.promptTokens ?? null,
      completionTokens: entry.usage?.completionTokens ?? null,
      cachedTokens: entry.usage?.cachedTokens ?? null,
      costUsd: entry.usage?.costUsd ?? null,
    });

    const requestLog = truncateForConsole(entry.request || "");
    const responseLog = truncateForConsole(entry.response || "");
    const usageLog = formatLlmUsage(entry.usage);
    console.log(
      `[api-log] ${entry.type.toUpperCase()} ${entry.provider} ${entry.endpoint} status=${entry.statusCode ?? "n/a"} duration=${entry.duration ?? "n/a"}ms` +
        (usageLog ? ` usage: ${usageLog}` : "") +
        `\n  sent: ${requestLog || "(empty)"}\n  received: ${responseLog || "(empty)"}`
    );
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
}

export async function logApi(entry: ApiLogEntry) {
  if (!(await isSettingEnabled("ENABLE_API_LOGGING", "ENABLE_API_LOGGING"))) return;
  await insertApiLog(entry);
}

/**
 * Central LLM call logging (type "llm"). Called from callLLM/callLLMWithAudio
 * in src/lib/providers/llm.ts so every LLM request in the app is captured —
 * routes, services and internal helpers alike. Gated by its own
 * ENABLE_LLM_LOGGING setting (default off) so it can be toggled independently
 * of the general API logging for generation providers. Never throws: a
 * logging failure must not break the provider call it belongs to.
 */
export async function logLlmCall(entry: ApiLogEntry) {
  try {
    if (!(await isSettingEnabled("ENABLE_LLM_LOGGING", "ENABLE_LLM_LOGGING"))) return;
    await insertApiLog(entry);
  } catch (e) {
    console.error("Failed to log LLM call:", e);
  }
}
