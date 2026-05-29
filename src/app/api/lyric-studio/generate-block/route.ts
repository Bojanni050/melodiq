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

interface ExistingBlock {
  type: BlockType;
  label: string;
  content: string;
}

interface GenerateBlockBody {
  blockType?: unknown;
  blockLabel?: unknown;
  topic?: unknown;
  mood?: unknown;
  language?: unknown;
  style?: unknown;
  vocalistTag?: unknown;
  performerDirections?: unknown;
  existingBlocks?: unknown;
  chorusMode?: unknown;
  isFirstChorus?: unknown;
  temperature?: unknown;
  topP?: unknown;
}

type ChorusMode = "repeat" | "variation";

function isChorusMode(value: unknown): value is ChorusMode {
  return value === "repeat" || value === "variation";
}

type VocalistTag = "auto" | "male" | "female" | "together";

function isVocalistTag(value: unknown): value is VocalistTag {
  return value === "auto" || value === "male" || value === "female" || value === "together";
}

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

function isExistingBlock(value: unknown): value is ExistingBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Record<string, unknown>;
  return (
    isBlockType(block.type) &&
    typeof block.label === "string" &&
    typeof block.content === "string"
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI provider failed";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: GenerateBlockBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { blockType, blockLabel, topic, mood, language, style, existingBlocks, chorusMode, isFirstChorus, temperature, topP } = body;
  const vocalistTag = body.vocalistTag;
  const performerDirections = body.performerDirections;

  if (!isBlockType(blockType)) {
    return NextResponse.json({ error: "blockType is required" }, { status: 400 });
  }
  if (typeof blockLabel !== "string" || !blockLabel.trim()) {
    return NextResponse.json({ error: "blockLabel is required" }, { status: 400 });
  }
  if (typeof topic !== "string" || !topic.trim()) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  if (typeof mood !== "string" || !mood.trim()) {
    return NextResponse.json({ error: "mood is required" }, { status: 400 });
  }
  if (typeof language !== "string" || !language.trim()) {
    return NextResponse.json({ error: "language is required" }, { status: 400 });
  }
  if (style !== undefined && typeof style !== "string") {
    return NextResponse.json({ error: "style must be a string" }, { status: 400 });
  }
  if (vocalistTag !== undefined && !isVocalistTag(vocalistTag)) {
    return NextResponse.json({ error: "vocalistTag must be auto, male, female, or together" }, { status: 400 });
  }
  if (performerDirections !== undefined && typeof performerDirections !== "string") {
    return NextResponse.json({ error: "performerDirections must be a string" }, { status: 400 });
  }
  if (!Array.isArray(existingBlocks) || !existingBlocks.every(isExistingBlock)) {
    return NextResponse.json({ error: "existingBlocks must be an array" }, { status: 400 });
  }
  if (chorusMode !== undefined && !isChorusMode(chorusMode)) {
    return NextResponse.json({ error: "chorusMode must be repeat or variation" }, { status: 400 });
  }
  if (isFirstChorus !== undefined && typeof isFirstChorus !== "boolean") {
    return NextResponse.json({ error: "isFirstChorus must be a boolean" }, { status: 400 });
  }
  if (temperature !== undefined && (typeof temperature !== "number" || temperature < 0.1 || temperature > 1.2)) {
    return NextResponse.json({ error: "temperature must be between 0.1 and 1.2" }, { status: 400 });
  }
  if (topP !== undefined && (typeof topP !== "number" || topP < 0.1 || topP > 1.0)) {
    return NextResponse.json({ error: "topP must be between 0.1 and 1.0" }, { status: 400 });
  }

  const contextBlocks = existingBlocks.filter((block) => block.content.trim());
  const styleText = typeof style === "string" ? style.trim() : "";
  const context = contextBlocks
    .map((block) => `[${block.label}]\n${block.content.trim()}`)
    .join("\n\n");

  const performerDirectionsText = typeof performerDirections === "string" ? performerDirections.trim() : "";
  const vocalistTagValue: VocalistTag = isVocalistTag(vocalistTag) ? vocalistTag : "auto";
  const includePerformerTags = vocalistTagValue !== "auto" || performerDirectionsText.length > 0;
  const performerTagInstruction = includePerformerTags
    ? vocalistTagValue === "auto"
      ? `Prefix every non-empty lyric line with exactly one of these tags: [male], [female], or [together].
If performer direction is provided, include it inside the same brackets after a hyphen, e.g. [male - close-mic, dry, whispered].`
      : `Prefix every non-empty lyric line with this tag: [${vocalistTagValue}${performerDirectionsText ? ` - ${performerDirectionsText}` : ""}].`
    : "";

  let chorusInstruction = "";
  if (blockType === "chorus") {
    if (chorusMode === "repeat") {
      chorusInstruction = isFirstChorus
        ? "Write one definitive, memorable chorus that can be repeated verbatim later in the song."
        : "Keep this chorus extremely close to the first chorus and preserve the exact hook phrasing.";
    } else if (chorusMode === "variation") {
      chorusInstruction = isFirstChorus
        ? "Write a strong first chorus hook that can later be varied."
        : "Write a clear variation of the earlier chorus: keep the same core hook and message, but change some wording and line flow.";
    }
  }

  const systemPrompt = `You are a professional songwriter writing lyrics for one specific section of a song.

Write ONLY the lyrics for the requested section — no section label, no explanation, no preamble
The lyrics must be coherent with the other sections provided as context
Write in the specified language
Match the mood and topic provided
Keep syllable flow natural and singable
Chorus lines should be punchy and memorable
Bridge should contrast emotionally with the verses
${performerTagInstruction ? `${performerTagInstruction}\n` : ""}Return only the raw lyric text, nothing else`;
  const userPrompt = `Write the ${blockLabel} (${blockType}) for a song.
  const userPrompt = `Write the ${blockLabel} (${blockType}) for a song.
Topic: ${topic}
Mood/Vibe: ${mood}
Language: ${language}
${performerDirectionsText ? `Performer direction: ${performerDirectionsText}` : ""}
${vocalistTagValue !== "auto" ? `Vocalist tag: [${vocalistTagValue}]` : ""}
${styleText ? `Style/Genre: ${styleText}` : ""}
${chorusInstruction ? `Chorus instruction: ${chorusInstruction}` : ""}
${context ? `--- EXISTING SECTIONS (for context and coherence) ---
${context}
--- END CONTEXT ---` : ""}

  try {
    const llmProvider = await getLLMProviderForPurpose("lyrics");
    const result = await callLLM(userPrompt, systemPrompt, {
      purpose: "lyrics",
      temperature: typeof temperature === "number" ? temperature : undefined,
      topP: typeof topP === "number" ? topP : undefined,
    });

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/generate-block",
      request: JSON.stringify({ blockType, blockLabel, topic, mood, language, style, vocalistTag: vocalistTagValue, performerDirections: performerDirectionsText, temperature, topP }),
      response: JSON.stringify({ result: result.substring(0, 200) }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ result });
  } catch (error) {
    const message = getErrorMessage(error);
    const llmProvider = await getLLMProviderForPurpose("lyrics");

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/generate-block",
      request: JSON.stringify({ blockType, blockLabel, topic, mood, language, vocalistTag: vocalistTagValue, performerDirections: performerDirectionsText, temperature, topP }),
      response: JSON.stringify({ error: message }),
      statusCode: 500,
      duration: Date.now() - startTime,
    });

    console.error(error);
    return NextResponse.json({ error: "AI provider failed" }, { status: 500 });
  }
}
