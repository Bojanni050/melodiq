export interface LLMModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string | number;
    completion: string | number;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string;
  };
  // Populated for Eden AI (from its capabilities.input/output_modalities) and
  // OpenRouter (from architecture.input/output_modalities) model catalogs.
  // Left undefined for providers without this data — badges just don't render.
  capabilities?: {
    inputModalities: string[];
    outputModalities: string[];
  };
}

const WEBHOOK_DEFAULTS = [
  { key: "POYO_WEBHOOK_URL", path: "/api/webhooks/poyo" },
  { key: "POYO_WAV_WEBHOOK_URL", path: "/api/webhooks/poyo-wav" },
  { key: "TEMPOLOR_WEBHOOK_URL", path: "/api/webhooks/tempolor" },
  { key: "MUSICGPT_WEBHOOK_URL", path: "/api/webhooks/musicgpt" },
  { key: "MINIMAX_WEBHOOK_URL", path: "/api/webhooks/minimax" },
  { key: "APIFRAME_WEBHOOK_URL", path: "/api/webhooks/apiframe" },
] as const;

export function formatPrice(price: string | number): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (!num || num === 0) return "Free";
  if (num >= 1) return `$${num.toFixed(2)}/1M tokens`;
  return `$${(num * 1_000_000).toFixed(2)}/1M tokens`;
}

export function truncateDescription(
  text: string,
  maxLines: number = 3,
): { text: string; truncated: boolean } {
  if (!text) return { text: "", truncated: false };
  const words = text.split(" ");
  const maxWords = maxLines * 12;
  if (words.length <= maxWords) {
    return { text, truncated: false };
  }
  return { text: `${words.slice(0, maxWords).join(" ")}...`, truncated: true };
}

export function createModelPlaceholder(id: string): LLMModel {
  return {
    id,
    name: id,
    description: "",
    pricing: { prompt: "0", completion: "0" },
    context_length: 0,
    architecture: { modality: "", tokenizer: "", instruct_type: "" },
  };
}

// Family/publisher patterns known for strong instruction-following and
// reliable structured (JSON) output, roughly in priority order — used to
// surface a handful of sane defaults at the top of a model picker rather
// than making the user scroll a 400+ entry alphabetical list cold. This is
// a heuristic, not a live benchmark: it matches on publisher+family (which
// stays stable) rather than exact version suffixes (which don't), so it
// keeps working as providers ship new point releases.
const RECOMMENDED_MODEL_PATTERNS = [
  "gpt-5",
  "claude-sonnet",
  "claude-opus",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-3",
  "deepseek-v3",
  "grok-4",
  "qwen3",
  "glm-5",
  "glm-4",
  "mistral-large",
  "llama-4",
];

// Picks up to `count` models, at most one per recommended family, preferring
// the cheapest matching entry within each family. Falls back to whatever
// families are actually present in `models` — a picker with a smaller
// catalog (e.g. a narrower Eden AI subset) may surface fewer than `count`.
export function pickRecommendedModels(models: LLMModel[], count = 5): LLMModel[] {
  const picked: LLMModel[] = [];
  const usedIds = new Set<string>();

  for (const pattern of RECOMMENDED_MODEL_PATTERNS) {
    if (picked.length >= count) break;
    const matches = models
      .filter((m) => {
        const id = m.id.toLowerCase();
        // ":batch" variants are async/batch-processing endpoints (cheaper,
        // but not a synchronous request/response) — wrong shape for our
        // interactive callLLM() usage, so never recommend them even though
        // they'd otherwise "win" on price.
        return !usedIds.has(m.id) && id.includes(pattern) && !id.includes(":batch");
      })
      .sort((a, b) => Number(a.pricing.prompt || 0) - Number(b.pricing.prompt || 0));
    if (matches.length === 0) continue;
    picked.push(matches[0]);
    usedIds.add(matches[0].id);
  }

  return picked;
}

export function buildWebhookUrl(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/$/, "")}${path}`;
}

export function applyWebhookDefaults(settings: Record<string, string>): Record<string, string> {
  const appUrl = settings.APP_URL?.trim();
  if (!appUrl) return settings;

  const next = { ...settings };
  for (const { key, path } of WEBHOOK_DEFAULTS) {
    if (!next[key]) {
      next[key] = buildWebhookUrl(appUrl, path);
    }
  }

  return next;
}
