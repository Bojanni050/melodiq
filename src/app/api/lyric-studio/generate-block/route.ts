export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logApi } from "@/lib/logger";
import { callLLM, getLLMProviderForPurpose } from "@/lib/providers/llm";
import { requireAuth } from "@/lib/require-auth";

type BlockType = "intro" | "verse" | "pre-chorus" | "chorus" | "post-chorus" | "bridge" | "outro";

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
  existingBlocks?: unknown;
}

const BLOCK_TYPES: BlockType[] = [
  "intro",
  "verse",
  "pre-chorus",
  "chorus",
  "post-chorus",
  "bridge",
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

  const { blockType, blockLabel, topic, mood, language, style, existingBlocks } = body;

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
  if (!Array.isArray(existingBlocks) || !existingBlocks.every(isExistingBlock)) {
    return NextResponse.json({ error: "existingBlocks must be an array" }, { status: 400 });
  }

  const contextBlocks = existingBlocks.filter((block) => block.content.trim());
  const styleText = typeof style === "string" ? style.trim() : "";
  const context = contextBlocks
    .map((block) => `[${block.label}]\n${block.content.trim()}`)
    .join("\n\n");

  const systemPrompt = `You are a professional songwriter writing lyrics for one specific section of a song.

Write ONLY the lyrics for the requested section — no section label, no explanation, no preamble
The lyrics must be coherent with the other sections provided as context
Write in the specified language
Match the mood and topic provided
Keep syllable flow natural and singable
Chorus lines should be punchy and memorable
Bridge should contrast emotionally with the verses
Return only the raw lyric text, nothing else`;

  const userPrompt = `Write the ${blockLabel} (${blockType}) for a song.
Topic: ${topic}
Mood/Vibe: ${mood}
Language: ${language}
${styleText ? `Style/Genre: ${styleText}` : ""}
${context ? `--- EXISTING SECTIONS (for context and coherence) ---
${context}
--- END CONTEXT ---` : ""}
Now write only the lyrics for: ${blockLabel}`;

  try {
    const llmProvider = await getLLMProviderForPurpose("lyrics");
    const result = await callLLM(userPrompt, systemPrompt, { purpose: "lyrics" });

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/generate-block",
      request: JSON.stringify({ blockType, blockLabel, topic, mood, language, style }),
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
      request: JSON.stringify({ blockType, blockLabel, topic, mood, language }),
      response: JSON.stringify({ error: message }),
      statusCode: 500,
      duration: Date.now() - startTime,
    });

    console.error(error);
    return NextResponse.json({ error: "AI provider failed" }, { status: 500 });
  }
}
