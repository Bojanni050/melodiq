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
