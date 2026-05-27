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

interface TranslateBlock {
  id: string;
  type: BlockType;
  label: string;
  content: string;
}

interface TranslateBody {
  targetLanguage?: unknown;
  blocks?: unknown;
}

function isBlockType(value: unknown): value is BlockType {
  return (
    value === "intro" ||
    value === "verse" ||
    value === "pre-chorus" ||
    value === "chorus" ||
    value === "post-chorus" ||
    value === "bridge" ||
    value === "intrumental" ||
    value === "instrumetal-drop" ||
    value === "outro"
  );
}

function isTranslateBlock(value: unknown): value is TranslateBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Record<string, unknown>;
  return (
    typeof block.id === "string" &&
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

  let body: TranslateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { targetLanguage, blocks } = body;

  if (typeof targetLanguage !== "string" || !targetLanguage.trim()) {
    return NextResponse.json({ error: "targetLanguage is required" }, { status: 400 });
  }
  if (targetLanguage.length > 255) {
    return NextResponse.json({ error: "targetLanguage must be 255 characters or fewer" }, { status: 400 });
  }
  if (!Array.isArray(blocks) || !blocks.every(isTranslateBlock)) {
    return NextResponse.json({ error: "blocks must be an array" }, { status: 400 });
  }

  const translatableBlocks = blocks.filter((block) => block.content.trim());
  if (translatableBlocks.length === 0) {
    return NextResponse.json({ error: "No lyrics to translate" }, { status: 400 });
  }

  const llmProvider = await getLLMProviderForPurpose("lyrics");

  const systemPrompt = `You are a professional lyric translator.

Translate each lyric block into the target language while preserving:
- Song meaning and emotional intent
- Singable line flow and cadence
- Section order and section labels

Rules:
- Return valid JSON only, no markdown, no explanations
- Output must be an object with a single key: "blocks"
- "blocks" must be an array of objects with keys: id, content
- Keep the same id values as provided
- Do not omit or add blocks
- Do not include extra keys
- Preserve line breaks inside each block`;

  const userPrompt = `Target language: ${targetLanguage.trim()}

Translate these lyric blocks:
${JSON.stringify(
    translatableBlocks.map(({ id, label, content }) => ({ id, label, content })),
    null,
    2
  )}

Return only JSON.`;

  try {
    const raw = await callLLM(userPrompt, systemPrompt, { purpose: "lyrics" });
    let parsed: { blocks?: Array<{ id?: unknown; content?: unknown }> } | null = null;

    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (!parsed || !Array.isArray(parsed.blocks)) {
      throw new Error("Invalid translation response format");
    }

    const translatedById = new Map<string, string>();
    for (const item of parsed.blocks) {
      if (typeof item?.id !== "string" || typeof item?.content !== "string") continue;
      translatedById.set(item.id, item.content);
    }

    const translatedBlocks = blocks.map((block) => {
      const translatedContent = translatedById.get(block.id);
      return {
        ...block,
        content: typeof translatedContent === "string" && translatedContent.trim()
          ? translatedContent
          : block.content,
      };
    });

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/translate",
      request: JSON.stringify({ targetLanguage, blocks: translatableBlocks.map((block) => ({ id: block.id, label: block.label })) }),
      response: JSON.stringify({ translatedCount: translatedById.size }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ blocks: translatedBlocks });
  } catch (error) {
    const message = getErrorMessage(error);

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/translate",
      request: JSON.stringify({ targetLanguage, blockCount: translatableBlocks.length }),
      response: JSON.stringify({ error: message }),
      statusCode: 500,
      duration: Date.now() - startTime,
    });

    console.error(error);
    return NextResponse.json({ error: "Vertalen is mislukt" }, { status: 500 });
  }
}
