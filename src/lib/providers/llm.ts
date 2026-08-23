import axios from "axios";
import { getSetting } from "@/lib/settings";
import { buildAvoidWordsInstruction } from "@/lib/lyrics-avoid-words";
import { logToFile } from "@/lib/file-logger";

const LOG_FILE = "track-dna.log";
function logComposition(message: string): void {
  console.info(message);
  logToFile(LOG_FILE, message);
}
function warnComposition(message: string): void {
  console.warn(message);
  logToFile(LOG_FILE, message);
}

export type LLMProvider = "openrouter" | "openai" | "edenai";
export type LLMPurpose = "prompt" | "lyrics" | "image" | "trackdna" | "advanced" | "lyriciq" | "default";

interface CallLLMOptions {
  purpose?: LLMPurpose;
  provider?: LLMProvider;
  openRouterModelOverride?: string;
  openAiModelOverride?: string;
  edenAiModelOverride?: string;
  temperature?: number;
  topP?: number;
}

function normalizeProvider(value: string): LLMProvider | "" {
  if (value === "openrouter" || value === "openai" || value === "edenai") return value;
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

export async function callLLM(
  prompt: string,
  systemPrompt: string,
  options: string | CallLLMOptions = {}
) {
  const normalizedOptions =
    typeof options === "string" ? { openRouterModelOverride: options } : options;
  const purpose = normalizedOptions.purpose || "default";
  const requestedProvider =
    normalizedOptions.provider || (await getPurposeProvider(purpose)) || "openrouter";

  const OPENROUTER_KEY = (await getSetting("OPENROUTER_API_KEY")) || process.env.OPENROUTER_API_KEY || "";
  const OPENROUTER_MODEL =
    normalizedOptions.openRouterModelOverride ||
    (purpose === "prompt" ? await getSetting("OPENROUTER_PROMPT_MODEL") : "") ||
    (purpose === "lyrics" ? await getSetting("OPENROUTER_LYRICS_MODEL") : "") ||
    (purpose === "trackdna" ? await getSetting("OPENROUTER_TRACKDNA_MODEL") : "") ||
    (purpose === "advanced" ? await getSetting("OPENROUTER_ADVANCED_DNA_MODEL") : "") ||
    (purpose === "lyriciq" ? await getSetting("OPENROUTER_LYRICIQ_MODEL") : "") ||
    (await getSetting("OPENROUTER_MODEL")) ||
    process.env.OPENROUTER_MODEL ||
    "google/gemini-2.5-flash";
  const OPENAI_KEY = (await getSetting("OPENAI_API_KEY")) || process.env.OPENAI_API_KEY || "";
  const OPENAI_MODEL =
    normalizedOptions.openAiModelOverride ||
    (purpose === "prompt" ? await getSetting("OPENAI_PROMPT_MODEL") : "") ||
    (purpose === "lyrics" ? await getSetting("OPENAI_LYRICS_MODEL") : "") ||
    (purpose === "image" ? await getSetting("OPENAI_IMAGE_MODEL") : "") ||
    (purpose === "trackdna" ? await getSetting("OPENAI_TRACKDNA_MODEL") : "") ||
    (purpose === "advanced" ? await getSetting("OPENAI_ADVANCED_DNA_MODEL") : "") ||
    (purpose === "lyriciq" ? await getSetting("OPENAI_LYRICIQ_MODEL") : "") ||
    (await getSetting("OPENAI_MODEL")) ||
    process.env.OPENAI_MODEL ||
    "gpt-4o";
  const EDENAI_KEY = (await getSetting("EDENAI_API_KEY")) || process.env.EDENAI_API_KEY || "";
  const EDENAI_MODEL =
    normalizedOptions.edenAiModelOverride ||
    (purpose === "prompt" ? await getSetting("EDENAI_PROMPT_MODEL") : "") ||
    (purpose === "lyrics" ? await getSetting("EDENAI_LYRICS_MODEL") : "") ||
    (purpose === "image" ? await getSetting("EDENAI_IMAGE_MODEL") : "") ||
    (purpose === "trackdna" ? await getSetting("EDENAI_TRACKDNA_MODEL") : "") ||
    (purpose === "advanced" ? await getSetting("EDENAI_ADVANCED_DNA_MODEL") : "") ||
    (purpose === "lyriciq" ? await getSetting("EDENAI_LYRICIQ_MODEL") : "") ||
    (await getSetting("EDENAI_MODEL")) ||
    process.env.EDENAI_MODEL ||
    "openai/gpt-4o-mini";

  if (requestedProvider === "openrouter" && OPENROUTER_KEY) {
    let res;
    try {
      res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: OPENROUTER_MODEL,
          temperature: normalizedOptions.temperature,
          top_p: normalizedOptions.topP,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          },
          timeout: 60_000,
        }
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const looksLikeHtml =
        typeof data === "string" && data.trimStart().startsWith("<");
      const isParseError = /Unexpected token|is not valid JSON/i.test(err?.message || "");

      if (looksLikeHtml || isParseError) {
        throw new Error(
          `OpenRouter (${OPENROUTER_MODEL}) returned a non-JSON response` +
          (status ? ` (HTTP ${status})` : "") +
          `. The model is likely overloaded or unavailable — try again or switch model.`
        );
      }

      const apiMessage =
        (typeof data === "object" && data?.error?.message) ||
        err?.message ||
        "OpenRouter request failed";
      throw new Error(
        `OpenRouter request failed${status ? ` (HTTP ${status})` : ""}: ${apiMessage}`
      );
    }

    const content = res.data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error(
        `OpenRouter response missing content. Body: ${JSON.stringify(res.data).slice(0, 200)}`
      );
    }
    return content;
  }

  if (requestedProvider === "openai" && OPENAI_KEY) {
    let res;
    try {
      res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: OPENAI_MODEL,
          temperature: normalizedOptions.temperature,
          top_p: normalizedOptions.topP,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 60_000,
        }
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const looksLikeHtml =
        typeof data === "string" && data.trimStart().startsWith("<");
      const isParseError = /Unexpected token|is not valid JSON/i.test(err?.message || "");

      if (looksLikeHtml || isParseError) {
        throw new Error(
          `OpenAI (${OPENAI_MODEL}) returned a non-JSON response` +
          (status ? ` (HTTP ${status})` : "") +
          `. The service is likely overloaded or unavailable — try again or switch model.`
        );
      }

      const apiMessage =
        (typeof data === "object" && data?.error?.message) ||
        err?.message ||
        "OpenAI request failed";
      throw new Error(
        `OpenAI request failed${status ? ` (HTTP ${status})` : ""}: ${apiMessage}`
      );
    }

    const content = res.data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error(
        `OpenAI response missing content. Body: ${JSON.stringify(res.data).slice(0, 200)}`
      );
    }
    return content;
  }

  if (requestedProvider === "edenai" && EDENAI_KEY) {
    let res;
    try {
      // Eden AI's chat endpoint is OpenAI-compatible: same messages/choices
      // shape, but the model is namespaced as "provider/model" (e.g.
      // "openai/gpt-4o-mini") since Eden AI is itself a multi-provider router.
      res = await axios.post(
        "https://api.edenai.run/v3/chat/completions",
        {
          model: EDENAI_MODEL,
          temperature: normalizedOptions.temperature,
          top_p: normalizedOptions.topP,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${EDENAI_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 60_000,
        }
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const looksLikeHtml =
        typeof data === "string" && data.trimStart().startsWith("<");
      const isParseError = /Unexpected token|is not valid JSON/i.test(err?.message || "");

      if (looksLikeHtml || isParseError) {
        throw new Error(
          `Eden AI (${EDENAI_MODEL}) returned a non-JSON response` +
          (status ? ` (HTTP ${status})` : "") +
          `. The model is likely overloaded or unavailable — try again or switch model.`
        );
      }

      const apiMessage =
        (typeof data === "object" && (data?.error?.message || data?.message)) ||
        err?.message ||
        "Eden AI request failed";
      throw new Error(
        `Eden AI request failed${status ? ` (HTTP ${status})` : ""}: ${apiMessage}`
      );
    }

    const content = res.data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error(
        `Eden AI response missing content. Body: ${JSON.stringify(res.data).slice(0, 200)}`
      );
    }
    return content;
  }

  throw new Error(`No ${requestedProvider} LLM provider configured. Check the selected provider and API key in Settings.`);
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

  try {
    const raw = await callLLM(lyrics.slice(0, 6000), systemPrompt, { purpose: "trackdna" });
    const parsed = parseJsonObject(raw);
    if (!parsed) return null;

    const score = Number(parsed.score);
    if (!Number.isFinite(score) || score < 1 || score > 10) return null;
    const notes = typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : "";

    return { score: Math.round(score * 10) / 10, notes };
  } catch (error) {
    console.warn("[llm] Failed to score lyrics quality:", error);
    return null;
  }
}

export interface CompositionQualityScore {
  score: number;
  notes: string;
}

// Automated Track DNA "Composition" signal — judges arrangement/structure by
// actually listening to the rendered audio, not just its metadata. Needs an
// audio-input-capable model, so it bypasses callLLM's text-only request body
// and builds its own — but it still follows the same "trackdna" purpose
// provider/key/model settings as everything else, so switching
// TRACKDNA_LLM_PROVIDER (e.g. to edenai) is respected here too.
const DEFAULT_AUDIO_MODEL: Record<LLMProvider, string> = {
  openrouter: "google/gemini-2.5-flash",
  edenai: "google/gemini-2.5-flash",
  openai: "gpt-4o-audio-preview",
};

interface AudioProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  url: string;
  headers: Record<string, string>;
}

async function resolveAudioProviderConfig(): Promise<AudioProviderConfig | null> {
  const provider = await getLLMProviderForPurpose("trackdna");

  if (provider === "openrouter") {
    const apiKey = (await getSetting("OPENROUTER_API_KEY")) || process.env.OPENROUTER_API_KEY || "";
    if (!apiKey) return null;
    const model =
      (await getSetting("OPENROUTER_TRACKDNA_MODEL")) || DEFAULT_AUDIO_MODEL.openrouter;
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
    const model = (await getSetting("OPENAI_TRACKDNA_MODEL")) || DEFAULT_AUDIO_MODEL.openai;
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
    const model = (await getSetting("EDENAI_TRACKDNA_MODEL")) || DEFAULT_AUDIO_MODEL.edenai;
    return {
      provider,
      apiKey,
      model,
      url: "https://api.edenai.run/v3/chat/completions",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    };
  }

  return null;
}

export async function scoreCompositionQuality(
  audioBuffer: Buffer,
  format: string = "mp3"
): Promise<CompositionQualityScore | null> {
  if (!audioBuffer?.length) {
    warnComposition("[llm][composition] skipped: empty audio buffer");
    return null;
  }

  const config = await resolveAudioProviderConfig();
  if (!config) {
    warnComposition(
      `[llm][composition] skipped: no API key configured for the TRACKDNA_LLM_PROVIDER setting`
    );
    return null;
  }

  const systemPrompt = `You are a professional music producer and arranger critiquing a finished track.

Listen to the audio and rate it 1-10 for composition and arrangement quality: structure (intro/verse/chorus/bridge flow), dynamic build across sections, instrumentation choices, and mix balance. Judge only what you actually hear — do not guess from genre conventions.

Rules:
- Return ONLY strict JSON, no markdown, no code fences, no explanation outside the JSON.
- Format exactly: {"score": <number 1-10, one decimal>, "notes": "<one short sentence, max 20 words>"}`;

  logComposition(
    `[llm][composition] calling ${config.provider}/${config.model} (format=${format}, audioBytes=${audioBuffer.length})`
  );

  try {
    const res = await axios.post(
      config.url,
      {
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Rate this track's composition and arrangement." },
              { type: "input_audio", input_audio: { data: audioBuffer.toString("base64"), format } },
            ],
          },
        ],
      },
      {
        headers: config.headers,
        timeout: 60_000,
      }
    );

    const raw = res.data?.choices?.[0]?.message?.content;
    logComposition(
      `[llm][composition] response HTTP ${res.status}, content: ${
        typeof raw === "string" ? JSON.stringify(raw.slice(0, 500)) : `<no content> body=${JSON.stringify(res.data).slice(0, 500)}`
      }`
    );

    if (typeof raw !== "string") {
      warnComposition("[llm][composition] rejected: response had no string content");
      return null;
    }

    const parsed = parseJsonObject(raw);
    if (!parsed) {
      warnComposition(`[llm][composition] rejected: could not parse JSON out of model response: ${JSON.stringify(raw.slice(0, 500))}`);
      return null;
    }

    const score = Number(parsed.score);
    if (!Number.isFinite(score) || score < 1 || score > 10) {
      warnComposition(`[llm][composition] rejected: score out of range/invalid: ${JSON.stringify(parsed)}`);
      return null;
    }
    const notes = typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : "";

    logComposition(`[llm][composition] success: score=${score}, notes=${JSON.stringify(notes)}`);
    return { score: Math.round(score * 10) / 10, notes };
  } catch (error: any) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    warnComposition(
      `[llm][composition] request failed${status ? ` (HTTP ${status})` : ""}: ${
        data ? JSON.stringify(data).slice(0, 500) : error?.message || String(error)
      }`
    );
    return null;
  }
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

  try {
    const raw = await callLLM(prompt.slice(0, 2000), systemPrompt, { purpose: "trackdna" });
    const parsed = parseJsonObject(raw);
    if (!parsed || !Array.isArray(parsed.tags)) return null;

    const tags = parsed.tags
      .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      .map((tag) => tag.trim().slice(0, 30))
      .slice(0, 4);

    return tags.length > 0 ? tags : null;
  } catch (error) {
    console.warn("[llm] Failed to extract atmosphere tags:", error);
    return null;
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

  const [openRouterImageModel, openAiImageModel, edenAiImageModel] = await Promise.all([
    getSetting("OPENROUTER_IMAGE_MODEL"),
    getSetting("OPENAI_IMAGE_MODEL"),
    getSetting("EDENAI_IMAGE_MODEL"),
  ]);
  return callLLM(userPrompt, systemPrompt, {
    purpose: "image",
    openRouterModelOverride: openRouterImageModel || undefined,
    openAiModelOverride: openAiImageModel || undefined,
    edenAiModelOverride: edenAiImageModel || undefined,
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
