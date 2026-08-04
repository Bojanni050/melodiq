export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logApi } from "@/lib/logger";
import { callLLM, getLLMProviderForPurpose } from "@/lib/providers/llm";
import { requireAuth } from "@/lib/require-auth";

type BlockType =
  | "intro"
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "post-chorus"
  | "bridge"
  | "intrumental"
  | "instrumetal-drop"
  | "outro";

const BLOCK_TYPES: BlockType[] = [
  "intro",
  "verse",
  "pre-chorus",
  "chorus",
  "post-chorus",
  "bridge",
  "intrumental",
  "instrumetal-drop",
  "outro",
];

function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && BLOCK_TYPES.includes(value as BlockType);
}

interface LyricIQBody {
  blockType?: unknown;
  blockLabel?: unknown;
  lyrics?: unknown;
  language?: unknown;
  topic?: unknown;
  mood?: unknown;
  style?: unknown;
  temperature?: unknown;
  topP?: unknown;
  llmModel?: unknown;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI provider failed";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: LyricIQBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { blockType, blockLabel, lyrics, language, topic, mood, style, temperature, topP, llmModel } = body;

  if (!isBlockType(blockType)) {
    return NextResponse.json({ error: "blockType is required" }, { status: 400 });
  }
  if (typeof blockLabel !== "string" || !blockLabel.trim()) {
    return NextResponse.json({ error: "blockLabel is required" }, { status: 400 });
  }
  if (typeof lyrics !== "string" || !lyrics.trim()) {
    return NextResponse.json({ error: "lyrics are required" }, { status: 400 });
  }
  if (temperature !== undefined && (typeof temperature !== "number" || temperature < 0.1 || temperature > 1.2)) {
    return NextResponse.json({ error: "temperature must be between 0.1 and 1.2" }, { status: 400 });
  }
  if (topP !== undefined && (typeof topP !== "number" || topP < 0.1 || topP > 1.0)) {
    return NextResponse.json({ error: "topP must be between 0.1 and 1.0" }, { status: 400 });
  }
  if (llmModel !== undefined && typeof llmModel !== "string") {
    return NextResponse.json({ error: "llmModel must be a string" }, { status: 400 });
  }

  const lyricsText = lyrics.trim();
  const languageText = typeof language === "string" && language.trim() ? language.trim() : "the same language as the input";
  const topicText = typeof topic === "string" ? topic.trim() : "";
  const moodText = typeof mood === "string" ? mood.trim() : "";
  const styleText = typeof style === "string" ? style.trim() : "";

  const systemPrompt = `You are **LyricIQ™**, the professional songwriting engine inside Melodiq.

You are an experienced songwriter, lyricist, vocal producer and lyric editor.
Your job is to improve existing lyrics.
You are NOT writing a new song.
You are polishing an existing one.

Think like a Grammy-winning songwriter helping another songwriter finish a great idea.
Your edits should often feel invisible.
The user should think: "I wish I had written it like that."

Never:
- rewrite for the sake of rewriting
- add unnecessary complexity
- replace good lines with different good lines
- make the lyrics sound AI-generated

If a line is already strong: keep it.
Improve only where improvement is genuinely needed.

Always preserve:
- language
- message
- emotional intent
- story
- perspective
- rhyme where appropriate
- overall structure
- approximate length

Improve:
- authenticity
- natural language
- conversational phrasing
- emotional honesty
- lyrical flow
- rhythm
- vocal phrasing
- singability
- memorable lines
- stronger hooks
- vivid imagery
- subtle metaphors
- believable dialogue
- concrete observations
- storytelling
- emotional progression
- originality

Remove:
- generic wording
- AI clichés
- repetitive phrases
- robotic sentence structure
- filler
- unnatural expressions
- predictable rhymes
- over-explaining emotions
- abstract statements without imagery

Favor:
- simplicity over cleverness
- implication over explanation
- restraint over drama
- humanity over perfection

Write lyrics that feel lived-in.
Use sensory details when appropriate.
Replace abstract emotions with scenes, observations or moments whenever possible.
Avoid sounding poetic simply to sound poetic.
The lyrics should always remain easy to sing.
Read every line as if someone must perform it live.

# Section Awareness
Adapt the rewrite to the current song section.
Verse: focus on storytelling, imagery, progression, natural language and scene building.
Chorus: prioritize memorable hooks, emotional payoff, repetition with purpose, singability and commercial strength.
Pre-Chorus: build anticipation and naturally lead into the chorus.
Bridge: introduce contrast, reflection or a fresh emotional perspective. Avoid repeating previous lyrical ideas.
Intro: keep the writing concise, intriguing and atmospheric.
Outro: provide emotional resolution or a memorable final thought.
Post-Chorus: echo the hook with a fresh angle or short, repeatable payoff.

# Output Rules
Return ONLY the rewritten lyrics.
Do not explain your changes.
Do not add notes.
Do not use markdown.
Do not add section headers.
Preserve existing line breaks whenever possible.`;

  const userPrompt = `Song section: ${blockLabel} (${blockType})
${languageText ? `Language: ${languageText}\n` : ""}${topicText ? `Topic: ${topicText}\n` : ""}${moodText ? `Mood: ${moodText}\n` : ""}${styleText ? `Style: ${styleText}\n` : ""}
Lyrics:
${lyricsText}

Improve these lyrics using LyricIQ™.
Keep the same song.
Simply make it feel like it was written by a better songwriter.`;

  try {
    const llmProvider = await getLLMProviderForPurpose("lyrics");
    const result = await callLLM(userPrompt, systemPrompt, {
      purpose: "lyrics",
      temperature: typeof temperature === "number" ? temperature : undefined,
      topP: typeof topP === "number" ? topP : undefined,
      openRouterModelOverride: typeof llmModel === "string" && llmModel.trim() ? llmModel.trim() : undefined,
    });

    const cleaned = result
      .replace(/^```[a-zA-Z]*\s*/g, "")
      .replace(/\s*```$/g, "")
      .trim();

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/lyric-iq",
      request: JSON.stringify({ blockType, blockLabel, language, topic, mood, style, temperature, topP, llmModel }),
      response: JSON.stringify({ result: cleaned.substring(0, 200) }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ result: cleaned });
  } catch (error) {
    const message = getErrorMessage(error);
    const llmProvider = await getLLMProviderForPurpose("lyrics");

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/lyric-iq",
      request: JSON.stringify({ blockType, blockLabel, language, topic, mood, style, temperature, topP }),
      response: JSON.stringify({ error: message }),
      statusCode: 500,
      duration: Date.now() - startTime,
    });

    console.error(error);
    return NextResponse.json({ error: "AI provider failed" }, { status: 500 });
  }
}
