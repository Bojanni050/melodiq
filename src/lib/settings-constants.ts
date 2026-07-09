export interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: "password" | "text";
    placeholder: string;
  }>;
  testEndpoint: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "lyria",
    name: "Google Lyria 3",
    description: "Synchronous music generation provider",
    fields: [
      {
        key: "LYRIA_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "lyria_...",
      },
    ],
    testEndpoint: "lyria",
  },
  {
    id: "poyo",
    name: "PoYo (Suno)",
    description: "Async music generation with webhook support",
    fields: [
      {
        key: "POYO_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "poyo_...",
      },
    ],
    testEndpoint: "poyo",
  },
  {
    id: "tempolor",
    name: "Tempolor",
    description: "Async music generation with HD output",
    fields: [
      {
        key: "TEMPOLOR_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "tempolor_...",
      },
    ],
    testEndpoint: "tempolor",
  },
  {
    id: "musicgpt",
    name: "MusicGPT",
    description: "Async music generation with AI voice models",
    fields: [
      {
        key: "MUSICGPT_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "musicgpt_...",
      },
    ],
    testEndpoint: "musicgpt",
  },
  {
    id: "minimax",
    name: "MiniMax Music 2.6",
    description: "Synchronous music generation with lyrics support",
    fields: [
      {
        key: "MINIMAX_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "minimax_...",
      },
    ],
    testEndpoint: "minimax",
  },
  {
    id: "mureka",
    name: "Mureka V9 (WaveSpeed)",
    description: "High-quality song generation with lyrics via WaveSpeed AI. Also powers HeartMuLa (same API key).",
    fields: [
      {
        key: "WAVESPEED_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "wsa_...",
      },
    ],
    testEndpoint: "mureka",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Primary LLM provider for prompt optimization and lyrics",
    fields: [
      {
        key: "OPENROUTER_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "sk-or-...",
      },
    ],
    testEndpoint: "openrouter",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Fallback LLM provider",
    fields: [
      {
        key: "OPENAI_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "sk-...",
      },
      {
        key: "OPENAI_PROMPT_MODEL",
        label: "Prompt Model",
        type: "text",
        placeholder: "gpt-4o",
      },
      {
        key: "OPENAI_LYRICS_MODEL",
        label: "Lyrics Model",
        type: "text",
        placeholder: "gpt-4o",
      },
    ],
    testEndpoint: "openai",
  },
  {
    id: "apiframe",
    name: "APIFrame",
    description: "Unified AI music generation (Suno, Udio, Lyria, Mureka, ElevenLabs)",
    fields: [
      {
        key: "APIFRAME_API_KEY",
        label: "API Key",
        type: "password",
        placeholder: "afk_...",
      },
    ],
    testEndpoint: "apiframe",
  },
];

export const WEBHOOK_DEFAULTS = [
  { key: "POYO_WEBHOOK_URL", path: "/api/webhooks/poyo" },
  { key: "POYO_WAV_WEBHOOK_URL", path: "/api/webhooks/poyo-wav" },
  { key: "TEMPOLOR_WEBHOOK_URL", path: "/api/webhooks/tempolor" },
  { key: "MUSICGPT_WEBHOOK_URL", path: "/api/webhooks/musicgpt" },
  { key: "MINIMAX_WEBHOOK_URL", path: "/api/webhooks/minimax" },
  { key: "MUREKA_WEBHOOK_URL", path: "/api/webhooks/mureka" },
  { key: "HEARTMULA_WEBHOOK_URL", path: "/api/webhooks/heartmula" },
  { key: "APIFRAME_WEBHOOK_URL", path: "/api/webhooks/apiframe" },
] as const;
