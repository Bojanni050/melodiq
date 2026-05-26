import axios from "axios";
import { getSetting } from "@/lib/settings";

export type LLMProvider = "openrouter" | "openai";
export type LLMPurpose = "prompt" | "lyrics" | "image" | "default";

interface CallLLMOptions {
  purpose?: LLMPurpose;
  provider?: LLMProvider;
  openRouterModelOverride?: string;
  openAiModelOverride?: string;
  temperature?: number;
  topP?: number;
}

function normalizeProvider(value: string): LLMProvider | "" {
  if (value === "openrouter" || value === "openai") return value;
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
    return "openrouter";
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
    (await getSetting("OPENROUTER_MODEL")) ||
    process.env.OPENROUTER_MODEL ||
    "openai/gpt-5";
  const OPENAI_KEY = (await getSetting("OPENAI_API_KEY")) || process.env.OPENAI_API_KEY || "";
  const OPENAI_MODEL =
    normalizedOptions.openAiModelOverride ||
    (purpose === "prompt" ? await getSetting("OPENAI_PROMPT_MODEL") : "") ||
    (purpose === "lyrics" ? await getSetting("OPENAI_LYRICS_MODEL") : "") ||
    (await getSetting("OPENAI_MODEL")) ||
    process.env.OPENAI_MODEL ||
    "gpt-4o";

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
- Keep it 2-4 minutes when sung`;

  return callLLM(idea, systemPrompt, { purpose: "lyrics" });
}

export async function generateImagePrompt(
  songContent: string,
  title: string,
  instrumental: boolean
): Promise<string> {
  const type = instrumental ? "instrumental" : "vocal";

  const systemPrompt = `You are a visual art director specializing in album cover design.
Given a song title and content, write a short visual scene description for an AI image generator.

Rules:
- Respond with ONLY the visual description — no explanation, no preamble
- Maximum 2 sentences
- Focus on: mood, atmosphere, lighting, colors, and a concrete visual scene or subject
- No text, letters, or words in the description
- No mention of music, instruments, or song titles
- Make it cinematic and evocative`;

  const userPrompt = `Song title: ${title}
Type: ${type}
Content: ${songContent.slice(0, 600)}`;

  const imageModel = await getSetting("OPENROUTER_IMAGE_MODEL");
  return callLLM(userPrompt, systemPrompt, {
    purpose: "image",
    openRouterModelOverride: imageModel || undefined,
  });
}
