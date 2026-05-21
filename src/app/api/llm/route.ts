export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logApi } from "@/lib/logger";
import { callLLM, getLLMProviderForPurpose } from "@/lib/providers/llm";
import { requireAuth } from "@/lib/require-auth";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI provider failed";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const {
    type,
    idea,
    context,
    structure,
    customStructure,
    vocalGender,
    provider,
    language,
    instrumental,
  } = await request.json();

  if (!idea || typeof idea !== "string") {
    return NextResponse.json({ error: "idea is required" }, { status: 400 });
  }
  if (idea.length > 2000) {
    return NextResponse.json({ error: "idea must be 2000 characters or fewer" }, { status: 400 });
  }
  if (language !== undefined && language !== null && (typeof language !== "string" || language.length > 255)) {
    return NextResponse.json({ error: "language must be 255 characters or fewer" }, { status: 400 });
  }

  let result: string;
  let llmProvider = "openrouter";

  try {
    if (type === "optimize") {
      llmProvider = await getLLMProviderForPurpose("prompt");
      const systemPrompt = `You are a creative assistant that generates optimized music style prompts for Suno.

The song's language, structure, theme, mood, tempo, key, and BPM are provided via the app. 
Generate the style prompt directly without asking clarifying questions.

Suno style prompt rules:
- Never use artist names, band names, producer names, or song titles. Always translate 
  references into descriptive stylistic language covering vocal tone, arrangement, 
  instrumentation, rhythmic approach, atmosphere, production texture, and genre fusion.
- Describe the full musical picture: genre, subgenre, mood, tempo feel, instrumentation, 
  vocal style, production aesthetic, and sonic atmosphere.
- If BPM is provided, include it as a numeric tag, e.g. '120 BPM'.
- If key or scale is provided, include it, e.g. 'A minor', 'D major', 'Dorian mode'.
- Use comma-separated tags and short descriptive phrases. Keep the prompt concise 
  but musically specific — avoid vague filler words.
- Avoid overusing exaggerated descriptors such as 'epic', 'powerful', 'massive', 
  or 'emotional'. Favor precise, production-oriented language instead.
- For vocal clarity and dryness, actively include descriptors such as 'dry vocals', 
  'close-mic', 'upfront vocal', 'no room sound', 'tight mix', or 'minimal ambience' 
  where appropriate.
- Do not include lyrics, section labels, or structural markers in the style prompt.`;

      const userPrompt = `${idea}

Language: ${language || "English"}
${context ? `Theme/Mood: ${context}` : ""}
${structure === "ai-choose" ? "Structure: AI chooses the best structure." : structure ? `Structure: ${customStructure || structure}` : ""}
${vocalGender && vocalGender !== "auto" ? `Vocal gender: ${vocalGender}` : ""}`;

      result = await callLLM(userPrompt, systemPrompt, { purpose: "prompt" });
    } else if (type === "lyrics") {
      llmProvider = await getLLMProviderForPurpose("lyrics");
      if (instrumental) {
        return NextResponse.json({ lyrics: "" });
      }

      const systemPrompt = `You are a creative assistant that writes original song lyrics in multiple languages, including Dutch and English.

Language and song structure are provided via the app. Generate lyrics directly without asking clarifying questions.

Lyrics rules:
- Write all lyrics in the language specified by the app. Do not switch languages unless the input explicitly includes mixed-language sections.
- Follow the song structure exactly as provided. Do not alter or reinterpret it.
- Always include clear section labels in square brackets, e.g. [Verse - sparse close-mic], [Chorus - restrained delivery, layered harmonies], [Bridge - whispered tension rising].
- Vocal and delivery instructions must always be inside the section title brackets — never added separately inside the lyrics body.
- All text inside square brackets [] must always be written in English, regardless of the main lyric language.
- Where vocal clarity or dryness is implied by the context, incorporate descriptors such as 'dry vocals', 'close-mic', 'upfront', 'no room sound', 'tight mix', or 'minimal ambience' inside the section label.
- Avoid overusing exaggerated emotional descriptors such as 'emotional', 'epic', 'powerful', or 'massive'. Favor controlled, nuanced direction instead.
- Write with vivid imagery, emotional specificity, and poetic freedom. Avoid literal or generic phrasing. Prioritize natural, grammatically correct language unless the user specifies otherwise.`;

      const userPrompt = `${idea}

Language: ${language || "English"}
${context ? `Topic/Mood: ${context}` : ""}
${vocalGender && vocalGender !== "auto" ? `Vocal gender: ${vocalGender}` : ""}
${structure === "ai-choose" ? "Choose the song structure that best fits the song idea and mood." : structure ? `Song structure:\n${customStructure || structure}` : ""}`;

      result = await callLLM(userPrompt, systemPrompt, { purpose: "lyrics" });
    } else {
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    await logApi({
      userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/llm",
      request: JSON.stringify({ type, idea, provider, language }),
      response: JSON.stringify({ result: result?.substring(0, 200) }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ result });
  } catch (error) {
    const message = getErrorMessage(error);

    await logApi({
      userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/llm",
      request: JSON.stringify({ type, idea }),
      response: JSON.stringify({ error: message }),
      statusCode: 500,
      duration: Date.now() - startTime,
    });

    console.error(error);
    return NextResponse.json({ error: message || "AI provider failed" }, { status: 500 });
  }
}
