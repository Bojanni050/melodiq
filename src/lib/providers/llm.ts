import axios from "axios";
import { getSetting } from "@/lib/settings";

async function callLLM(prompt: string, systemPrompt: string) {
  const OPENROUTER_KEY = await getSetting("OPENROUTER_API_KEY");
  const OPENROUTER_MODEL = await getSetting("OPENROUTER_MODEL") || "openai/gpt-5";
  const OPENAI_KEY = await getSetting("OPENAI_API_KEY");
  const OPENAI_MODEL = await getSetting("OPENAI_MODEL") || "gpt-4o";

  if (OPENROUTER_KEY) {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: OPENROUTER_MODEL,
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
      }
    );
    return res.data.choices[0].message.content;
  }

  if (OPENAI_KEY) {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
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
      }
    );
    return res.data.choices[0].message.content;
  }

  throw new Error("No LLM provider configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY in settings.");
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

  return callLLM(lyrics, systemPrompt);
}

export async function optimizePrompt(idea: string, provider: string): Promise<string> {
  const systemPrompt = `You are an expert music prompt engineer. Rewrite the user's rough song idea into a detailed, provider-optimized prompt for AI music generation. 

Rules:
- Remove any artist/band names (copyright scrubbing)
- Expand vague descriptions with specific musical terms
- Include mood, tempo, instrumentation, genre cues
- Format specifically for ${provider}
- Keep under 500 characters`;

  return callLLM(idea, systemPrompt);
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

  return callLLM(idea, systemPrompt);
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

  return callLLM(userPrompt, systemPrompt);
}
