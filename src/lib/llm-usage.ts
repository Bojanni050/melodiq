/**
 * Token/cost accounting for one LLM call.
 *
 * Only the fields the providers in this app actually report are modelled:
 * OpenRouter, OpenAI and DeepInfra all return a `usage` block, OpenRouter adds
 * `usage.cost` (USD credits) plus `prompt_tokens_details.cached_tokens` /
 * `cache_write_tokens`, which is what makes prompt-cache tuning measurable.
 *
 * Lives in its own module so both the LLM wrapper (src/lib/providers/llm.ts)
 * and the API logger (src/lib/logger.ts) can depend on it without a cycle.
 */
export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** Prompt tokens served from the provider's cache (0 when nothing was cached). */
  cachedTokens?: number;
  /** Prompt tokens written into the cache — billed above input price by some providers. */
  cacheWriteTokens?: number;
  /** Provider-reported cost in USD. OpenRouter reports it on every response. */
  costUsd?: number;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Reads a provider's `usage` block into an LlmUsage. Tolerates both the Chat
 * Completions shape (`prompt_tokens`, `completion_tokens`) and the Responses
 * shape (`input_tokens`, `output_tokens`), and returns null when the response
 * carried no usable usage at all so callers can skip writing an empty row.
 */
export function parseLlmUsage(rawUsage: unknown): LlmUsage | null {
  if (!rawUsage || typeof rawUsage !== "object") return null;
  const usage = rawUsage as Record<string, any>;
  const details = usage.prompt_tokens_details || usage.input_tokens_details || {};

  const parsed: LlmUsage = {
    promptTokens: finiteNumber(usage.prompt_tokens ?? usage.input_tokens),
    completionTokens: finiteNumber(usage.completion_tokens ?? usage.output_tokens),
    totalTokens: finiteNumber(usage.total_tokens),
    cachedTokens: finiteNumber(details.cached_tokens),
    cacheWriteTokens: finiteNumber(details.cache_write_tokens),
    costUsd: finiteNumber(usage.cost),
  };

  const hasAnything = Object.values(parsed).some((value) => value !== undefined);
  return hasAnything ? parsed : null;
}

/** One-line summary for the api log / console. Empty string when nothing is known. */
export function formatLlmUsage(usage: LlmUsage | null | undefined): string {
  if (!usage) return "";
  const parts: string[] = [];
  if (usage.promptTokens !== undefined) parts.push(`prompt=${usage.promptTokens}`);
  if (usage.completionTokens !== undefined) parts.push(`completion=${usage.completionTokens}`);
  if (usage.cachedTokens !== undefined && usage.cachedTokens > 0) parts.push(`cached=${usage.cachedTokens}`);
  if (usage.cacheWriteTokens !== undefined && usage.cacheWriteTokens > 0) parts.push(`cache_write=${usage.cacheWriteTokens}`);
  if (usage.costUsd !== undefined) parts.push(`cost=$${usage.costUsd.toFixed(6)}`);
  return parts.join(" ");
}
