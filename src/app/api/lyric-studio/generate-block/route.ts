export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logApi } from "@/lib/logger";
import { callLLM, getLLMProviderForPurpose } from "@/lib/providers/llm";
import { requireAuth } from "@/lib/require-auth";
import { buildAvoidWordsInstruction } from "@/lib/lyrics-avoid-words";

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
  llmModel?: unknown;
  literalnessLevel?: unknown;
}

type ChorusMode = "repeat" | "variation";

function isChorusMode(value: unknown): value is ChorusMode {
  return value === "repeat" || value === "variation";
}

type VocalistTag = "auto" | "male" | "female" | "together" | "duet";

function isVocalistTag(value: unknown): value is VocalistTag {
  return value === "auto" || value === "male" || value === "female" || value === "together" || value === "duet";
}

type FixedVocalistTag = "male" | "female" | "together";

function isFixedVocalistTag(value: VocalistTag): value is FixedVocalistTag {
  return value === "male" || value === "female" || value === "together";
}

const VOCAL_DIRECTION_LABELS: Record<FixedVocalistTag, string> = {
  male: "Male Vocal",
  female: "Female Vocal",
  together: "Together Vocal",
};

// A fixed single-vocalist choice doesn't need the LLM's judgment — it's applied
// mechanically as a section-level tag after generation instead of being sent as
// a per-line instruction, so the model isn't burdened with tagging at all.
function buildVocalDirectionTag(blockLabel: string, tag: FixedVocalistTag, performerDirections: string): string {
  const parts = [VOCAL_DIRECTION_LABELS[tag], performerDirections].filter(Boolean);
  return `[${blockLabel} | ${parts.join(", ")}]`;
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

  const { blockType, blockLabel, topic, mood, language, style, existingBlocks, chorusMode, isFirstChorus, temperature, topP, llmModel, literalnessLevel } = body;
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
  if (llmModel !== undefined && typeof llmModel !== "string") {
    return NextResponse.json({ error: "llmModel must be a string" }, { status: 400 });
  }
  if (literalnessLevel !== undefined && (typeof literalnessLevel !== "number" || literalnessLevel < 1 || literalnessLevel > 10)) {
    return NextResponse.json({ error: "literalnessLevel must be between 1 and 10" }, { status: 400 });
  }

  const contextBlocks = existingBlocks.filter((block) => block.content.trim());
  const styleText = typeof style === "string" ? style.trim() : "";
  const context = contextBlocks
    .map((block) => `[${block.label}]\n${block.content.trim()}`)
    .join("\n\n");

  const performerDirectionsText = typeof performerDirections === "string" ? performerDirections.trim() : "";
  const vocalistTagValue: VocalistTag = isVocalistTag(vocalistTag) ? vocalistTag : "auto";
  const fixedVocalTag = isFixedVocalistTag(vocalistTagValue);
  // A fixed vocalist choice (male/female/together) doesn't need the LLM's judgment at
  // all — it's applied deterministically as a section tag after generation instead
  // (see buildVocalDirectionTag below). Only auto (AI infers the voice) and duet
  // (AI decides which lines go to which voice) still need per-line instructions.
  const includePerformerTags = !fixedVocalTag && (vocalistTagValue === "duet" || performerDirectionsText.length > 0);

  const performerTagInstruction = (() => {
    if (!includePerformerTags) return "";

    const dirNote = `If there are musical or vocal directions (e.g. "solo violin", "whispered", "close-mic"), include them inside the same brackets after a hyphen, e.g. [female - restrained, solo violin] or [male - powerful, full band].`;

    if (vocalistTagValue === "duet") {
      return `This is a duet. Place a tag at the start of each group of lines that belongs to the same vocalist — you do NOT need a tag on every line, only when the vocalist changes or at the start of a new section.
Use [male], [female], or [together] (for harmonised/unison lines). A tag applies to all following lines until the next tag appears.
Infer the gender combination (male/female, female/female, or male/male) from the topic, mood, pronouns, and existing sections. Be consistent throughout.
Example structure:
[female]
Line one
Line two

[male]
Line three
Line four

[together]
Chorus line one
Chorus line two
${dirNote}${performerDirectionsText ? `\nDuet structure instruction from the user: "${performerDirectionsText}" — follow this when deciding which vocalist sings which lines.` : ""}`;
    }

    return `Prefix every non-empty lyric line with exactly one of these tags: [male], [female], or [together].
Choose based on the topic, mood, pronouns, and existing sections to be consistent and natural.
${dirNote}`;
  })();

  const literalnessLevelValue = typeof literalnessLevel === "number" ? Math.round(literalnessLevel) : 5;
  const literalnessInstruction =
    literalnessLevelValue <= 3
      ? "Favor imagery, metaphor, and suggestion over plain statement — let meaning come through what's seen, heard, or touched rather than being said outright. Abstract, poetic phrasing is welcome."
      : literalnessLevelValue >= 8
        ? "Be direct and literal: say plainly what's happening and what's felt, the way someone would actually say it out loud. Avoid metaphor, symbolism, and vague imagery — state the concrete situation and emotion in clear, unambiguous language."
        : "Ground the writing in specific, concrete detail rather than naming the emotion outright — show it through what's seen, heard, or touched, not just how it's labeled.";

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
Keep syllable flow natural and singable — let meaningful words (nouns, verbs, adjectives) fall on the strong beats, the way they would if spoken aloud, and keep small connector words (a, the, of, and, to) light
Write with the sensibility of an experienced songwriter. Aim for lyrics that feel naturally written, specific to the story and emotionally believable rather than polished for the sake of sounding poetic.
Favor fresh observations, concrete situations, human behavior, subtle tension and details that feel naturally discovered within the story. Let emotion emerge through what people do, say, notice, avoid and leave unsaid.
Use simple language when simple language is right. Allow imperfections, ambiguity, conversational phrasing and unexpected turns. Don't make every line profound. Don't force imagery, metaphors, rhyme or symmetry.
Avoid predictable songwriting patterns by making the lyric feel specific to its characters, situation and point of view. Choose the less obvious expression when a familiar phrase comes naturally to mind.
Keep the writing understated and confident. Trust the listener to understand what is happening without explaining every emotion or meaning.
Prioritize authenticity, specificity, narrative coherence and memorable phrasing over lyrical decoration. The result should feel lived-in, distinctive and effortless rather than "written."
${literalnessInstruction}
Avoid AI songwriting clichés: stock breakup/nostalgia props like "your coat still on my chair", "half-empty cups gone cold", cold coffee, unmade beds, ticking clocks, or fading photographs. If the topic calls for that kind of imagery, find a detail specific to this song's actual topic and mood instead of reaching for the generic default
${buildAvoidWordsInstruction()}
Chorus lines should be punchy and memorable — build around one crucial, hook-worthy line rather than several competing ideas
Bridge should contrast emotionally with the verses
${performerTagInstruction ? `${performerTagInstruction}\n` : ""}Return only the raw lyric text, nothing else`;
  const userPrompt = `Write the ${blockLabel} (${blockType}) for a song.
Topic: ${topic}
Mood/Vibe: ${mood}
Language: ${language}
${styleText ? `Style/Genre: ${styleText}` : ""}
${!fixedVocalTag && performerDirectionsText ? `Performer direction: ${performerDirectionsText}` : ""}
${vocalistTagValue === "duet" ? `Vocalist tag: [duet]` : ""}
${chorusInstruction ? `Chorus instruction: ${chorusInstruction}` : ""}
${context ? `--- EXISTING SECTIONS (for context and coherence) ---
${context}
--- END CONTEXT ---` : ""}
Now write only the lyrics for: ${blockLabel}`;

  try {
    const llmProvider = await getLLMProviderForPurpose("lyrics");
    const rawResult = await callLLM(userPrompt, systemPrompt, {
      purpose: "lyrics",
      temperature: typeof temperature === "number" ? temperature : undefined,
      topP: typeof topP === "number" ? topP : undefined,
      openRouterModelOverride: typeof llmModel === "string" && llmModel.trim() ? llmModel.trim() : undefined,
    });
    const result = isFixedVocalistTag(vocalistTagValue)
      ? `${buildVocalDirectionTag(blockLabel, vocalistTagValue, performerDirectionsText)}\n${rawResult.trim()}`
      : rawResult;

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/generate-block",
      request: JSON.stringify({ blockType, blockLabel, topic, mood, language, style, vocalistTag: vocalistTagValue, performerDirections: performerDirectionsText, temperature, topP, llmModel, literalnessLevel: literalnessLevelValue }),
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
