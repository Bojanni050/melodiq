export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/providers/llm";
import { requireAuth } from "@/lib/require-auth";
import {
  buildBlockPrompts,
  buildVocalDirectionTag,
  isBlockType,
  isChorusMode,
  isFixedVocalistTag,
  isVocalistTag,
  type BlockType,
  type VocalistTag,
} from "@/lib/lyrics-block-prompt";
import { sanitizePromptPersona } from "@/lib/lyric-personas";

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
  llmModel?: unknown;
  literalnessLevel?: unknown;
  lineCount?: unknown;
  creativityLevel?: unknown;
  /** Saved writing persona (name, bio, selected fragments) for this song. */
  persona?: unknown;
  /**
   * Set by the client when it writes a whole song section by section: the
   * song-level part of the prompt is then reused across up to a dozen calls
   * within a few minutes, which is the only situation where prompt caching pays
   * for itself (some providers bill a cache *write* above input price).
   */
  cachePrefix?: unknown;
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

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: GenerateBlockBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { blockType, blockLabel, topic, mood, language, style, existingBlocks, chorusMode, isFirstChorus, temperature, topP, llmModel, literalnessLevel, lineCount, creativityLevel } = body;
  const vocalistTag = body.vocalistTag;
  const performerDirections = body.performerDirections;
  const cachePrefix = body.cachePrefix === true;

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
  if (llmModel !== undefined && typeof llmModel !== "string") {
    return NextResponse.json({ error: "llmModel must be a string" }, { status: 400 });
  }
  if (literalnessLevel !== undefined && (typeof literalnessLevel !== "number" || literalnessLevel < 1 || literalnessLevel > 10)) {
    return NextResponse.json({ error: "literalnessLevel must be between 1 and 10" }, { status: 400 });
  }
  if (creativityLevel !== undefined && (typeof creativityLevel !== "number" || creativityLevel < 1 || creativityLevel > 10)) {
    return NextResponse.json({ error: "creativityLevel must be between 1 and 10" }, { status: 400 });
  }
  if (lineCount !== undefined && (typeof lineCount !== "number" || !Number.isFinite(lineCount) || lineCount < 1 || lineCount > 16)) {
    return NextResponse.json({ error: "lineCount must be between 1 and 16" }, { status: 400 });
  }

  const persona = body.persona === undefined ? undefined : sanitizePromptPersona(body.persona);
  if (body.persona !== undefined && !persona) {
    return NextResponse.json({ error: "persona is invalid" }, { status: 400 });
  }

  const contextBlocks = existingBlocks.filter((block) => block.content.trim());
  const styleText = typeof style === "string" ? style.trim() : "";
  const performerDirectionsText = typeof performerDirections === "string" ? performerDirections.trim() : "";
  const vocalistTagValue: VocalistTag = isVocalistTag(vocalistTag) ? vocalistTag : "auto";
  const literalnessLevelValue = typeof literalnessLevel === "number" ? Math.round(literalnessLevel) : 5;
  const lineCountValue = typeof lineCount === "number" ? Math.min(16, Math.max(1, Math.round(lineCount))) : 4;
  const creativityLevelValue = typeof creativityLevel === "number" ? Math.round(creativityLevel) : 5;

  // Prompt layout lives in src/lib/lyrics-block-prompt.ts: static system prompt,
  // then a per-song cacheable prefix, then this section's own instructions.
  const { systemPrompt, cacheablePrefix, userPrompt } = buildBlockPrompts({
    blockType,
    blockLabel,
    topic: topic.trim(),
    mood: mood.trim(),
    language: language.trim(),
    style: styleText,
    existingBlocks: contextBlocks.map(({ type, label, content }) => ({ type, label, content })),
    chorusMode: isChorusMode(chorusMode) ? chorusMode : undefined,
    isFirstChorus: typeof isFirstChorus === "boolean" ? isFirstChorus : undefined,
    vocalistTag: vocalistTagValue,
    performerDirections: performerDirectionsText,
    literalnessLevel: literalnessLevelValue,
    creativityLevel: creativityLevelValue,
    lineCount: lineCountValue,
    persona: persona ?? undefined,
  });

  try {
    const rawResult = await callLLM(userPrompt, systemPrompt, {
      purpose: "lyrics",
      temperature: typeof temperature === "number" ? temperature : undefined,
      topP: typeof topP === "number" ? topP : undefined,
      openRouterModelOverride: typeof llmModel === "string" && llmModel.trim() ? llmModel.trim() : undefined,
      // Only when the caller is writing the whole song: a one-off section would
      // pay for a cache write it never reads back.
      cacheablePrefix: cachePrefix ? cacheablePrefix : undefined,
      userId: auth.userId,
    });
    const result = isFixedVocalistTag(vocalistTagValue)
      ? `${buildVocalDirectionTag(blockLabel, vocalistTagValue, performerDirectionsText)}\n${rawResult.trim()}`
      : rawResult;

    return NextResponse.json({ result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "AI provider failed" }, { status: 500 });
  }
}
