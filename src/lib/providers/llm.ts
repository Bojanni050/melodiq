import axios from "axios";
import { getSetting } from "@/lib/settings";
import { buildAvoidWordsInstruction } from "@/lib/lyrics-avoid-words";
import { logToFile } from "@/lib/file-logger";
import { parseLlmUsage, formatLlmUsage, type LlmUsage } from "@/lib/llm-usage";

export type { LlmUsage };

const LOG_FILE = "track-dna.log";

// DeepInfra serves an OpenAI-compatible API under this prefix; the chat
// completion path and the public model catalog both hang off it.
const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";

// Hopscotch is an OpenAI-compatible LLM router. Its SDK base URL is the /v1
// prefix; model ids are always provider-pinned ("provider/model").
const HOPSCOTCH_BASE_URL = "https://api.hopscotchlabs.ai/v1";

export type LLMProvider = "openrouter" | "openai" | "edenai" | "deepinfra" | "hopscotch";
export type LLMPurpose = "prompt" | "lyrics" | "image" | "trackdna" | "advanced" | "lyriciq" | "default";

interface CallLLMOptions {
  purpose?: LLMPurpose;
  provider?: LLMProvider;
  openRouterModelOverride?: string;
  openAiModelOverride?: string;
  edenAiModelOverride?: string;
  deepInfraModelOverride?: string;
  hopscotchModelOverride?: string;
  temperature?: number;
  topP?: number;
  /** Ask for a strict JSON object (`response_format: json_object`); callers that parse JSON should set this. */
  json?: boolean;
  /** Hard cap on the completion so a runaway answer can't burn tokens. */
  maxTokens?: number;
  /** Receives the provider's usage block (tokens/cost/cache) when the response carries one. */
  onUsage?: (usage: LlmUsage) => void;
}

function normalizeProvider(value: string): LLMProvider | "" {
  if (
    value === "openrouter" ||
    value === "openai" ||
    value === "edenai" ||
    value === "deepinfra" ||
    value === "hopscotch"
  ) {
    return value;
  }
  return "";
}

async function getPurposeProvider(purpose: LLMPurpose): Promise<LLMProvider | ""> {
  if (purpose === "prompt") {
    return normalizeProvider(await getSetting("PROMPT_LLM_PROVIDER")) || "openrouter";
  }
  if (purpose === "lyrics") {
    return normalizeProvider(await getSetting("LYRICS_LLM_PROVIDER")) || "openrouter";
  }
  if (purpose === "image") {
    return normalizeProvider(await getSetting("IMAGE_LLM_PROVIDER")) || "openrouter";
  }
  if (purpose === "trackdna") {
    return normalizeProvider(await getSetting("TRACKDNA_LLM_PROVIDER")) || "openrouter";
  }
  if (purpose === "advanced") {
    return normalizeProvider(await getSetting("ADVANCED_LLM_PROVIDER")) || "openrouter";
  }
  if (purpose === "lyriciq") {
    return normalizeProvider(await getSetting("LYRICIQ_LLM_PROVIDER")) || "openrouter";
  }
  return normalizeProvider(await getSetting("LLM_PROVIDER"));
}

export async function getLLMProviderForPurpose(purpose: LLMPurpose): Promise<LLMProvider> {
  return (await getPurposeProvider(purpose)) || "openrouter";
}

/**
 * All five providers speak the OpenAI-compatible chat completions shape, so the
 * request body, the model cascade and the error mapping live here once and only
 * the endpoint, settings prefix and default model differ per provider. A new
 * cross-cutting option (JSON mode, usage reporting, a retry) is one edit now
 * instead of five copies of the same block.
 */
interface ProviderConfig {
  /** Settings prefix: `<prefix>_API_KEY` and `<prefix>_MODEL`. */
  prefix: string;
  /** Name used in error messages. */
  label: string;
  /** OpenAI-compatible chat completions endpoint. */
  url: string;
  /** Used when neither a per-request override nor a settings value exists. */
  defaultModel: string;
  /** Per-purpose model settings; purposes without an entry fall back to `<prefix>_MODEL`. */
  purposeModelSettings: Partial<Record<LLMPurpose, string>>;
  /** Wording for the "non-JSON response" hint (OpenAI says service, not model). */
  overloadHint: string;
  /** Extra headers the provider wants on every request. */
  extraHeaders: () => Record<string, string>;
}

const MODEL_OVERLOAD_HINT = "The model is likely overloaded or unavailable — try again or switch model.";

// OpenAI is the one provider whose overload message talks about the service
// rather than the model; kept identical to the wording shipped before.
const SERVICE_OVERLOAD_HINT = "The service is likely overloaded or unavailable — try again or switch model.";

const PROVIDERS: Record<LLMProvider, ProviderConfig> = {
  openrouter: {
    prefix: "OPENROUTER",
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "google/gemini-2.5-flash",
    purposeModelSettings: {
      prompt: "OPENROUTER_PROMPT_MODEL",
      lyrics: "OPENROUTER_LYRICS_MODEL",
      trackdna: "OPENROUTER_TRACKDNA_MODEL",
      advanced: "OPENROUTER_ADVANCED_DNA_MODEL",
      lyriciq: "OPENROUTER_LYRICIQ_MODEL",
    },
    overloadHint: MODEL_OVERLOAD_HINT,
    extraHeaders: () => ({
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    }),
  },
  openai: {
    prefix: "OPENAI",
    label: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o",
    purposeModelSettings: {
      prompt: "OPENAI_PROMPT_MODEL",
      lyrics: "OPENAI_LYRICS_MODEL",
      image: "OPENAI_IMAGE_MODEL",
      trackdna: "OPENAI_TRACKDNA_MODEL",
      advanced: "OPENAI_ADVANCED_DNA_MODEL",
      lyriciq: "OPENAI_LYRICIQ_MODEL",
    },
    overloadHint: SERVICE_OVERLOAD_HINT,
    extraHeaders: () => ({}),
  },
  edenai: {
    prefix: "EDENAI",
    label: "Eden AI",
    // Eden AI's chat endpoint is OpenAI-compatible: same messages/choices
    // shape, but the model is namespaced as "provider/model" (e.g.
    // "openai/gpt-4o-mini") since Eden AI is itself a multi-provider router.
    url: "https://api.edenai.run/v3/chat/completions",
    defaultModel: "openai/gpt-4o-mini",
    purposeModelSettings: {
      prompt: "EDENAI_PROMPT_MODEL",
      lyrics: "EDENAI_LYRICS_MODEL",
      image: "EDENAI_IMAGE_MODEL",
      trackdna: "EDENAI_TRACKDNA_MODEL",
      advanced: "EDENAI_ADVANCED_DNA_MODEL",
      lyriciq: "EDENAI_LYRICIQ_MODEL",
    },
    overloadHint: MODEL_OVERLOAD_HINT,
    extraHeaders: () => ({}),
  },
  deepinfra: {
    prefix: "DEEPINFRA",
    label: "DeepInfra",
    // DeepInfra exposes an OpenAI-compatible surface under /v1/openai.
    url: `${DEEPINFRA_BASE_URL}/chat/completions`,
    defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    purposeModelSettings: {
      prompt: "DEEPINFRA_PROMPT_MODEL",
      lyrics: "DEEPINFRA_LYRICS_MODEL",
      image: "DEEPINFRA_IMAGE_MODEL",
      trackdna: "DEEPINFRA_TRACKDNA_MODEL",
      advanced: "DEEPINFRA_ADVANCED_DNA_MODEL",
      lyriciq: "DEEPINFRA_LYRICIQ_MODEL",
    },
    overloadHint: MODEL_OVERLOAD_HINT,
    extraHeaders: () => ({}),
  },
  hopscotch: {
    prefix: "HOPSCOTCH",
    label: "Hopscotch",
    // Hopscotch is an OpenAI-compatible router; the model must be
    // provider-pinned (e.g. "openai/gpt-4o-mini").
    url: `${HOPSCOTCH_BASE_URL}/chat/completions`,
    defaultModel: "openai/gpt-4o-mini",
    purposeModelSettings: {
      prompt: "HOPSCOTCH_PROMPT_MODEL",
      lyrics: "HOPSCOTCH_LYRICS_MODEL",
      image: "HOPSCOTCH_IMAGE_MODEL",
      trackdna: "HOPSCOTCH_TRACKDNA_MODEL",
      advanced: "HOPSCOTCH_ADVANCED_DNA_MODEL",
      lyriciq: "HOPSCOTCH_LYRICIQ_MODEL",
    },
    overloadHint: MODEL_OVERLOAD_HINT,
    extraHeaders: () => ({}),
  },
};

const MODEL_OVERRIDE_KEY: Record<LLMProvider, "openRouterModelOverride" | "openAiModelOverride" | "edenAiModelOverride" | "deepInfraModelOverride" | "hopscotchModelOverride"> = {
  openrouter: "openRouterModelOverride",
  openai: "openAiModelOverride",
  edenai: "edenAiModelOverride",
  deepinfra: "deepInfraModelOverride",
  hopscotch: "hopscotchModelOverride",
};

interface ResolvedChatProvider {
  provider: LLMProvider;
  label: string;
  model: string;
  url: string;
  headers: Record<string, string>;
  overloadHint: string;
}

/**
 * Resolves only the provider that is actually going to be called — the previous
 * version read every provider's key and every provider's model on every call
 * (11-16 settings reads for one lyrics call, of which two were needed).
 */
async function resolveChatProvider(
  provider: LLMProvider,
  purpose: LLMPurpose,
  options: CallLLMOptions
): Promise<ResolvedChatProvider | null> {
  const config = PROVIDERS[provider];
  const apiKey =
    (await getSetting(`${config.prefix}_API_KEY`)) || process.env[`${config.prefix}_API_KEY`] || "";
  if (!apiKey) return null;

  const override = options[MODEL_OVERRIDE_KEY[provider]];
  const purposeModelSetting = config.purposeModelSettings[purpose];
  const model =
    (typeof override === "string" && override.trim() ? override.trim() : "") ||
    (purposeModelSetting ? await getSetting(purposeModelSetting) : "") ||
    (await getSetting(`${config.prefix}_MODEL`)) ||
    process.env[`${config.prefix}_MODEL`] ||
    config.defaultModel;

  return {
    provider,
    label: config.label,
    model,
    url: config.url,
    overloadHint: config.overloadHint,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...config.extraHeaders(),
    },
  };
}

function toProviderError(resolved: ResolvedChatProvider, error: any): Error {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const looksLikeHtml = typeof data === "string" && data.trimStart().startsWith("<");
  const isParseError = /Unexpected token|is not valid JSON/i.test(error?.message || "");

  if (looksLikeHtml || isParseError) {
    return new Error(
      `${resolved.label} (${resolved.model}) returned a non-JSON response` +
        (status ? ` (HTTP ${status})` : "") +
        `. ${resolved.overloadHint}`
    );
  }

  const apiMessage =
    (typeof data === "object" && data && (data?.error?.message || data?.message)) ||
    error?.message ||
    `${resolved.label} request failed`;
  return new Error(
    `${resolved.label} request failed${status ? ` (HTTP ${status})` : ""}: ${apiMessage}`
  );
}

/** A 400/422 that mentions response_format means the provider won't take JSON mode. */
function isJsonModeRejection(error: any): boolean {
  const status = error?.response?.status;
  if (status !== 400 && status !== 422) return false;
  const payload = `${JSON.stringify(error?.response?.data ?? "")} ${error?.message ?? ""}`;
  return /response_format|response format|json_object|json mode/i.test(payload);
}

/**
 * POSTs one chat completion. When `response_format: json_object` is rejected by
 * an OpenAI-compatible router that doesn't implement it, the field is dropped
 * and the request is retried once — the prompt already demands strict JSON, so
 * the hint is optional. A rejected request isn't billed.
 */
async function postChatCompletion(
  resolved: ResolvedChatProvider,
  body: Record<string, unknown>,
  allowJsonFallback: boolean
) {
  try {
    return await axios.post(resolved.url, body, {
      headers: resolved.headers,
      timeout: 60_000,
    });
  } catch (error: any) {
    if (allowJsonFallback && body.response_format && isJsonModeRejection(error)) {
      const { response_format: _ignored, ...fallbackBody } = body;
      console.warn(
        `[llm] ${resolved.label} (${resolved.model}) rejected response_format — retrying without JSON mode`
      );
      try {
        return await axios.post(resolved.url, fallbackBody, {
          headers: resolved.headers,
          timeout: 60_000,
        });
      } catch (retryError: any) {
        throw toProviderError(resolved, retryError);
      }
    }
    throw toProviderError(resolved, error);
  }
}

export async function callLLM(
  prompt: string,
  systemPrompt: string,
  options: string | CallLLMOptions = {}
) {
  const normalizedOptions =
    typeof options === "string" ? { openRouterModelOverride: options } : options;
  const purpose = normalizedOptions.purpose || "default";
  const provider =
    normalizedOptions.provider || (await getPurposeProvider(purpose)) || "openrouter";

  const resolved = await resolveChatProvider(provider, purpose, normalizedOptions);
  if (!resolved) {
    throw new Error(`No ${provider} LLM provider configured. Check the selected provider and API key in Settings.`);
  }

  const body: Record<string, unknown> = {
    model: resolved.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  };
  // Left out entirely when undefined (JSON.stringify dropped them before too).
  if (normalizedOptions.temperature !== undefined) body.temperature = normalizedOptions.temperature;
  if (normalizedOptions.topP !== undefined) body.top_p = normalizedOptions.topP;
  if (normalizedOptions.maxTokens !== undefined) body.max_tokens = normalizedOptions.maxTokens;
  if (normalizedOptions.json) body.response_format = { type: "json_object" };

  const res = await postChatCompletion(resolved, body, normalizedOptions.json === true);

  const content = res.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(
      `${resolved.label} response missing content. Body: ${JSON.stringify(res.data).slice(0, 200)}`
    );
  }

  // Token/cost accounting: OpenRouter reports cost + cached tokens on every
  // response, OpenAI/DeepInfra report tokens. Handed to the caller so it lands
  // in the api log next to the request it belongs to.
  const usage = parseLlmUsage(res.data?.usage);
  if (usage) normalizedOptions.onUsage?.(usage);

  return content;
}

export async function generateTitle(lyrics: string): Promise<string> {
  const systemPrompt = `You are a professional music title generator.

Analyze the lyrics and derive the best title using this priority order:

1. REPEATING LINES — Find any line or phrase that appears more than once across sections (especially in [Chorus] or [Hook]). A repeated line is almost always the title.
2. HOOK PHRASE — If no exact repetition, extract the most memorable or emotionally charged phrase from a [Chorus] or [Hook] section.
3. THEMATIC CORE — If no clear hook exists (e.g. instrumental or abstract lyrics), distill the central theme or image into a short, evocative phrase.

Rules:
- Return ONLY the title — no quotes, no explanation, no punctuation at the end
- Maximum 6 words
- Match the language of the lyrics (Dutch title for Dutch lyrics, English for English, etc.)
- Do not invent words not present in or strongly implied by the lyrics
- Prefer the exact words from the lyrics over paraphrasing`;

  return callLLM(lyrics, systemPrompt, { purpose: "lyrics" });
}

export async function detectLanguageFromLyrics(lyrics: string): Promise<string | null> {
  const systemPrompt = `You are a language identification tool.

Read the lyrics and identify the language they are written in.

Rules:
- Return ONLY the language name in English (e.g. "English", "Dutch", "Spanish") — no explanation, no punctuation
- If the lyrics mix multiple languages, return the dominant one
- If you cannot determine a language, return exactly "unknown"`;

  const result = await callLLM(lyrics, systemPrompt, { purpose: "lyrics" });
  const trimmed = result.trim().replace(/^["'.]+|["'.]+$/g, "");
  if (!trimmed || trimmed.length > 50 || /unknown/i.test(trimmed)) return null;
  return trimmed;
}

export async function translateLyrics(
  lyrics: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const systemPrompt = `You are a professional song lyrics translator.

Translate the given lyrics from ${sourceLanguage} to ${targetLanguage}.

Rules:
- Preserve section tags exactly as-is (e.g. [Verse], [Chorus], [Bridge], [Outro])
- Preserve line breaks and overall structure
- Preserve meaning and emotional tone over literal word-for-word translation
- Keep it natural and singable in the target language
- Return ONLY the translated lyrics — no explanation, no preamble, no quotes around the result`;

  return callLLM(lyrics, systemPrompt, { purpose: "lyrics" });
}

export async function optimizePrompt(idea: string, provider: string): Promise<string> {
  const systemPrompt = `You are an expert music prompt engineer. Rewrite the user's rough song idea into a detailed, provider-optimized prompt for AI music generation. 

Rules:
- Remove any artist/band names (copyright scrubbing)
- Expand vague descriptions with specific musical terms
- Include mood, tempo, instrumentation, genre cues
- Format specifically for ${provider}
- Keep under 500 characters`;

  return callLLM(idea, systemPrompt, { purpose: "prompt" });
}

export async function generateLyrics(idea: string, language: string, instrumental: boolean): Promise<string> {
  if (instrumental) {
    return "";
  }

  const systemPrompt = `You are a professional songwriter. Write original lyrics based on the user's idea.

Rules:
- Use section tags: [Verse], [Chorus], [Verse], [Chorus], [Bridge], [Chorus], [Outro]
- Write original content (no copying existing songs)
- Language: ${language}
- Make it emotionally resonant and musically structured
- Keep it 2-4 minutes when sung

Craft:
- Write the chorus around one crucial, hook-worthy line — the phrase the whole song should be remembered for. Build the verses toward it rather than burying it.
- Ground feelings in specific, concrete detail instead of naming the emotion outright. "My eyes are red and swollen from salty tears" lands harder than "I feel so sad." Favor vivid, specific verbs and adjectives over generic ones (wander/stroll/shuffle, not just "walk").
- Balance external detail (what's seen, heard, touched — concrete and image-driven) with internal detail (thoughts and feelings) rather than leaning only on one.
- Preserve the natural stress of everyday speech: let meaningful words (nouns, verbs, adjectives) fall on the strong, singable beats, and let small connector words (a, the, of, and, to) stay light. A line should scan the way it would if spoken naturally.
- Favor one clear, simple central idea per section over cramming in too many images or ideas at once — simplicity carries more emotional weight than complexity.
${buildAvoidWordsInstruction()}`;

  return callLLM(idea, systemPrompt, { purpose: "lyrics" });
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/^```[a-zA-Z]*\s*/g, "").replace(/\s*```$/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface LyricsQualityScore {
  score: number;
  notes: string;
}

// Automated Track DNA "Lyrics" signal — replaces the human 1-10 vote with an
// LLM judge, since lyrics quality (unlike tempo/key) can't be measured from audio.
export async function scoreLyricsQuality(lyrics: string): Promise<LyricsQualityScore | null> {
  if (!lyrics?.trim()) return null;

  const systemPrompt = `You are a professional song lyrics critic.

Rate the given lyrics on a scale of 1-10 for overall quality (rhyme, structure, coherence, imagery, emotional impact).

Rules:
- Return ONLY strict JSON, no markdown, no code fences, no explanation outside the JSON.
- Format exactly: {"score": <number 1-10, one decimal>, "notes": "<one short sentence, max 20 words>"}`;

  let usage: LlmUsage | null = null;
  try {
    const raw = await callLLM(lyrics.slice(0, 6000), systemPrompt, {
      purpose: "trackdna",
      // The prompt asks for one tiny JSON object: JSON mode keeps it parseable,
      // the cap stops a runaway answer from being billed.
      json: true,
      maxTokens: 300,
      onUsage: (reported) => {
        usage = reported;
      },
    });
    const parsed = parseJsonObject(raw);
    if (!parsed) {
      // Previously a silent null: the call was paid for and the DNA field just
      // stayed empty until someone ran the backfill by hand.
      logToFile(
        LOG_FILE,
        `[llm] scoreLyricsQuality: unparseable response${usage ? ` (${formatLlmUsage(usage)})` : ""}: ${JSON.stringify(raw.slice(0, 200))}`
      );
      return null;
    }

    const score = Number(parsed.score);
    if (!Number.isFinite(score) || score < 1 || score > 10) return null;
    const notes = typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : "";

    return { score: Math.round(score * 10) / 10, notes };
  } catch (error) {
    console.warn("[llm] Failed to score lyrics quality:", error);
    return null;
  } finally {
    if (usage) logToFile(LOG_FILE, `[llm] scoreLyricsQuality usage: ${formatLlmUsage(usage)}`);
  }
}

// Shared audio-input plumbing for "Advanced Track DNA" — the single signal
// that listens to the rendered audio, producing a lyrics analysis, an
// audio-grounded composition/mix critique, and improvement tips all in one
// call (the former standalone text-only "Analyze Composition" score has been
// folded into this).
// actually listens to the rendered audio). Needs an audio-input-capable
// model, so it bypasses callLLM's text-only request body and builds its own
// — but it still follows the "advanced" purpose provider/key/model settings
// like everything else, so switching ADVANCED_LLM_PROVIDER is respected.
const DEFAULT_AUDIO_MODEL: Record<LLMProvider, string> = {
  openrouter: "google/gemini-2.5-flash",
  edenai: "google/gemini-2.5-flash",
  openai: "gpt-4o-audio-preview",
  // DeepInfra serves Gemini through its OpenAI-compatible endpoint and tags it
  // with "input-audio", so the same model works as a safe audio fallback.
  // Hopscotch routes to the same multimodal models (e.g. Gemini 2.5 Flash),
  // which accepts audio input through the OpenAI-compatible content shape.
  deepinfra: "google/gemini-2.5-flash",
  hopscotch: "google/gemini-2.5-flash",
};

interface AudioProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  url: string;
  headers: Record<string, string>;
}

const AUDIO_PURPOSE_MODEL_SETTING: Record<string, string> = {
  trackdna: "TRACKDNA_MODEL",
  advanced: "ADVANCED_DNA_MODEL",
};

async function resolveAudioProviderConfig(purpose: LLMPurpose): Promise<AudioProviderConfig | null> {
  const provider = await getLLMProviderForPurpose(purpose);
  const modelSettingSuffix = AUDIO_PURPOSE_MODEL_SETTING[purpose] || "TRACKDNA_MODEL";

  if (provider === "openrouter") {
    const apiKey = (await getSetting("OPENROUTER_API_KEY")) || process.env.OPENROUTER_API_KEY || "";
    if (!apiKey) return null;
    const model =
      (await getSetting(`OPENROUTER_${modelSettingSuffix}`)) || DEFAULT_AUDIO_MODEL.openrouter;
    return {
      provider,
      apiKey,
      model,
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      },
    };
  }

  if (provider === "openai") {
    const apiKey = (await getSetting("OPENAI_API_KEY")) || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return null;
    const model = (await getSetting(`OPENAI_${modelSettingSuffix}`)) || DEFAULT_AUDIO_MODEL.openai;
    return {
      provider,
      apiKey,
      model,
      url: "https://api.openai.com/v1/chat/completions",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    };
  }

  if (provider === "edenai") {
    const apiKey = (await getSetting("EDENAI_API_KEY")) || process.env.EDENAI_API_KEY || "";
    if (!apiKey) return null;
    const model = (await getSetting(`EDENAI_${modelSettingSuffix}`)) || DEFAULT_AUDIO_MODEL.edenai;
    return {
      provider,
      apiKey,
      model,
      url: "https://api.edenai.run/v3/chat/completions",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    };
  }

  if (provider === "deepinfra") {
    const apiKey = (await getSetting("DEEPINFRA_API_KEY")) || process.env.DEEPINFRA_API_KEY || "";
    if (!apiKey) return null;
    const model =
      (await getSetting(`DEEPINFRA_${modelSettingSuffix}`)) || DEFAULT_AUDIO_MODEL.deepinfra;
    return {
      provider,
      apiKey,
      model,
      url: `${DEEPINFRA_BASE_URL}/chat/completions`,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    };
  }

  if (provider === "hopscotch") {
    const apiKey = (await getSetting("HOPSCOTCH_API_KEY")) || process.env.HOPSCOTCH_API_KEY || "";
    if (!apiKey) return null;
    const model =
      (await getSetting(`HOPSCOTCH_${modelSettingSuffix}`)) || DEFAULT_AUDIO_MODEL.hopscotch;
    return {
      provider,
      apiKey,
      model,
      url: `${HOPSCOTCH_BASE_URL}/chat/completions`,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    };
  }

  return null;
}

/**
 * Sends audio (+ optional extra text) to whichever provider/model is
 * configured for `purpose`, following the same provider settings as callLLM.
 * Returns the raw model text (caller parses it); throws on any failure so
 * callers can log/handle it in their own context.
 */
export async function callLLMWithAudio(
  purpose: LLMPurpose,
  audioBuffer: Buffer,
  format: string,
  systemPrompt: string,
  userText: string,
  logTag: string = "[llm][audio]"
): Promise<string> {
  if (!audioBuffer?.length) {
    throw new Error("empty audio buffer");
  }

  const config = await resolveAudioProviderConfig(purpose);
  if (!config) {
    throw new Error(`no API key configured for the ${purpose === "advanced" ? "ADVANCED_LLM_PROVIDER" : "TRACKDNA_LLM_PROVIDER"} setting`);
  }

  console.info(
    `${logTag} calling ${config.provider}/${config.model} (format=${format}, audioBytes=${audioBuffer.length})`
  );
  logToFile(LOG_FILE, `${logTag} calling ${config.provider}/${config.model} (format=${format}, audioBytes=${audioBuffer.length})`);

  const res = await axios.post(
    config.url,
    {
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "input_audio", input_audio: { data: audioBuffer.toString("base64"), format } },
          ],
        },
      ],
    },
    {
      headers: config.headers,
      timeout: 90_000,
    }
  );

  const raw = res.data?.choices?.[0]?.message?.content;
  const logLine = `${logTag} response HTTP ${res.status}, content: ${
    typeof raw === "string" ? JSON.stringify(raw.slice(0, 500)) : `<no content> body=${JSON.stringify(res.data).slice(0, 500)}`
  }`;
  console.info(logLine);
  logToFile(LOG_FILE, logLine);

  if (typeof raw !== "string") {
    throw new Error("response had no string content");
  }
  return raw;
}

// Automated Track DNA "Atmosphere" signal — turns the generation prompt/style
// text (already stored, no extra input needed) into a few clean mood/genre tags.
export async function extractAtmosphereTags(prompt: string): Promise<string[] | null> {
  if (!prompt?.trim()) return null;

  const systemPrompt = `You are a music mood/genre tagger.

Read the style/prompt description and extract 2-4 short mood/genre labels that capture its atmosphere (e.g. "Melancholic", "Lo-fi", "Synthwave", "Uplifting").

Rules:
- Return ONLY strict JSON, no markdown, no code fences, no explanation outside the JSON.
- Format exactly: {"tags": ["Tag1", "Tag2"]}
- Each tag: 1-2 words, capitalized, no punctuation.
- Minimum 1 tag, maximum 4 tags.`;

  let usage: LlmUsage | null = null;
  try {
    const raw = await callLLM(prompt.slice(0, 2000), systemPrompt, {
      purpose: "trackdna",
      json: true,
      maxTokens: 200,
      onUsage: (reported) => {
        usage = reported;
      },
    });
    const parsed = parseJsonObject(raw);
    if (!parsed || !Array.isArray(parsed.tags)) {
      logToFile(
        LOG_FILE,
        `[llm] extractAtmosphereTags: unparseable response${usage ? ` (${formatLlmUsage(usage)})` : ""}: ${JSON.stringify(raw.slice(0, 200))}`
      );
      return null;
    }

    const tags = parsed.tags
      .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      .map((tag) => tag.trim().slice(0, 30))
      .slice(0, 4);

    return tags.length > 0 ? tags : null;
  } catch (error) {
    console.warn("[llm] Failed to extract atmosphere tags:", error);
    return null;
  } finally {
    if (usage) logToFile(LOG_FILE, `[llm] extractAtmosphereTags usage: ${formatLlmUsage(usage)}`);
  }
}

export async function generateImagePrompt(
  songContent: string,
  title: string,
  instrumental: boolean,
  lyrics?: string | null
): Promise<string> {
  const type = instrumental ? "instrumental" : "vocal";

  const systemPrompt = `You are a visual art director specializing in album cover design.
Given a song title, musical style/genre, and its lyrics (if vocal), write a short, highly evocative visual scene description for an AI image generator (Flux).

First, analyze the song style/genre and lyrics to choose the most appropriate artistic medium and style for the cover:
- For example, if it's cozy acoustic folk, indie, or an emotional ballad, maybe it should be "a soft watercolor illustration", "a textured oil painting", or "a warm nostalgic photograph".
- If it's playful synth-pop, electronic, or high-energy pop, maybe it should be "a vibrant modern cartoon illustration", "a colorful retro-futuristic digital art piece", or "bold graphic vector art".
- If it's a gritty rap/hip-hop, techno, or cyberpunk track, maybe it should be "a realistic gritty photograph with high contrast", "a dark cinematic street photograph", or "a glowing neon digital artwork".
- If it's heavy rock, metal, or dark ambient, maybe it should be "a textured surrealist charcoal drawing" or "an atmospheric dark painting".
Let the artistic medium and visual style feel organically derived from the mood, genre, and themes of the song.

Rules:
- Respond with ONLY the visual description — no explanation, no preamble.
- Maximum 2 sentences.
- Explicitly state the chosen style/medium (e.g., "a realistic photograph", "a textured oil painting", "a vibrant cartoon illustration", "a watercolor painting", "a minimalist charcoal sketch", etc.) in the description.
- Focus on: mood, atmosphere, lighting, colors, and a concrete visual scene or subject.
- No text, letters, or words in the description.
- No mention of music, instruments, or song titles.
- Make it cinematic and highly evocative.`;

  const userPrompt = `Song title: ${title}
Type: ${type}
Musical Style/Genre Cues: ${songContent}
${lyrics ? `Lyrics/Themes:\n${lyrics.slice(0, 1000)}` : ""}`;

  const [openRouterImageModel, openAiImageModel, edenAiImageModel, deepInfraImageModel, hopscotchImageModel] = await Promise.all([
    getSetting("OPENROUTER_IMAGE_MODEL"),
    getSetting("OPENAI_IMAGE_MODEL"),
    getSetting("EDENAI_IMAGE_MODEL"),
    getSetting("DEEPINFRA_IMAGE_MODEL"),
    getSetting("HOPSCOTCH_IMAGE_MODEL"),
  ]);
  return callLLM(userPrompt, systemPrompt, {
    purpose: "image",
    openRouterModelOverride: openRouterImageModel || undefined,
    openAiModelOverride: openAiImageModel || undefined,
    edenAiModelOverride: edenAiImageModel || undefined,
    deepInfraModelOverride: deepInfraImageModel || undefined,
    hopscotchModelOverride: hopscotchImageModel || undefined,
  });
}

export function normalizeAiTitle(raw: string): string | null {
  const firstLine = raw.split(/\r?\n/).find((line) => line.trim()) || "";
  const cleaned = firstLine
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/[\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, 80).trim();
}

export async function generateInstrumentalTitleFromPrompt(prompt: string): Promise<string | null> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return null;

  const systemPrompt = `You generate concise song titles for instrumental tracks.

Rules:
- Return only the title
- No quotes, no punctuation at the end, no explanation
- Maximum 6 words
- Keep it evocative and based on the style prompt`;

  const userPrompt = `Create one instrumental track title from this style prompt:\n\n${trimmedPrompt}`;

  try {
    const rawTitle = await callLLM(userPrompt, systemPrompt, { purpose: "prompt", temperature: 0.4 });
    return normalizeAiTitle(rawTitle);
  } catch {
    return null;
  }
}
