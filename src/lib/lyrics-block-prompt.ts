import { buildAvoidWordsInstruction } from "@/lib/lyrics-avoid-words";

export type BlockType =
  | "intro"
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "post-chorus"
  | "bridge"
  | "intrumental"
  | "instrumetal-drop"
  | "outro";

export const BLOCK_TYPES: BlockType[] = [
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

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && BLOCK_TYPES.includes(value as BlockType);
}

export type VocalistTag = "auto" | "male" | "female" | "together" | "duet";

export function isVocalistTag(value: unknown): value is VocalistTag {
  return value === "auto" || value === "male" || value === "female" || value === "together" || value === "duet";
}

export type FixedVocalistTag = "male" | "female" | "together";

export function isFixedVocalistTag(value: VocalistTag): value is FixedVocalistTag {
  return value === "male" || value === "female" || value === "together";
}

const VOCAL_DIRECTION_LABELS: Record<FixedVocalistTag, string> = {
  male: "Male Vocal",
  female: "Female Vocal",
  together: "Together Vocal",
};

/**
 * A fixed single-vocalist choice doesn't need the LLM's judgment — it's applied
 * mechanically as a section-level tag after generation instead of being sent as
 * a per-line instruction, so the model isn't burdened with tagging at all.
 */
export function buildVocalDirectionTag(blockLabel: string, tag: FixedVocalistTag, performerDirections: string): string {
  const parts = [VOCAL_DIRECTION_LABELS[tag], performerDirections].filter(Boolean);
  return `[${blockLabel} | ${parts.join(", ")}]`;
}

export type ChorusMode = "repeat" | "variation";

export function isChorusMode(value: unknown): value is ChorusMode {
  return value === "repeat" || value === "variation";
}

export interface BlockPromptParams {
  blockType: BlockType;
  blockLabel: string;
  topic: string;
  mood: string;
  language: string;
  style: string;
  existingBlocks: Array<{ type: BlockType; label: string; content: string }>;
  chorusMode?: ChorusMode;
  isFirstChorus?: boolean;
  vocalistTag: VocalistTag;
  performerDirections: string;
  literalnessLevel: number;
  creativityLevel: number;
  lineCount: number;
}

export interface BlockPrompts {
  /** Static across every request: safe to cache on the provider side, ever. */
  systemPrompt: string;
  /**
   * Everything that is identical for every section of the same song (topic,
   * mood, style, the song-level sliders, the sections written so far). Sent as
   * its own content block so a provider can reuse it — see
   * `CallLLMOptions.cacheablePrefix`.
   */
  cacheablePrefix: string;
  /** The per-section remainder: section identity, line count, chorus rule. */
  userPrompt: string;
}

/**
 * Builds the prompts for one section of a song, split so the cacheable part is
 * stable:
 *
 *   system prompt      — never changes
 *   cacheable prefix   — changes per song, not per section
 *   user prompt        — changes per section (and only here)
 *
 * Previously the literalness/rhyme/line-count/performer instructions were
 * interpolated into the system prompt, which made every request's prefix unique
 * and made prompt caching impossible for every provider.
 */
export function buildBlockPrompts(params: BlockPromptParams): BlockPrompts {
  const styleText = params.style.trim();
  const context = params.existingBlocks
    .filter((block) => block.content.trim())
    .map((block) => `[${block.label}]\n${block.content.trim()}`)
    .join("\n\n");

  const fixedVocalTag = isFixedVocalistTag(params.vocalistTag);
  const includePerformerTags =
    !fixedVocalTag && (params.vocalistTag === "duet" || params.performerDirections.length > 0);

  const performerTagInstruction = (() => {
    if (!includePerformerTags) return "";

    const dirNote = `If there are musical or vocal directions (e.g. "solo violin", "whispered", "close-mic"), include them inside the same brackets after a hyphen, e.g. [female - restrained, solo violin] or [male - powerful, full band].`;

    if (params.vocalistTag === "duet") {
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
${dirNote}${params.performerDirections ? `\nDuet structure instruction from the user: "${params.performerDirections}" — follow this when deciding which vocalist sings which lines.` : ""}`;
    }

    return `Prefix every non-empty lyric line with exactly one of these tags: [male], [female], or [together].
Choose based on the topic, mood, pronouns, and existing sections to be consistent and natural.
${dirNote}`;
  })();

  const literalnessInstruction =
    params.literalnessLevel <= 3
      ? "Favor imagery, metaphor, and suggestion over plain statement — let meaning come through what's seen, heard, or touched rather than being said outright. Abstract, poetic phrasing is welcome."
      : params.literalnessLevel >= 8
        ? "Be direct and literal: say plainly what's happening and what's felt, the way someone would actually say it out loud. Avoid metaphor, symbolism, and vague imagery — state the concrete situation and emotion in clear, unambiguous language."
        : "Ground the writing in specific, concrete detail rather than naming the emotion outright — show it through what's seen, heard, or touched, not just how it's labeled.";

  // Rhyme strength follows the creativity slider: low creativity wants the
  // familiar, dependable sound of rhyme; high creativity prefers authenticity
  // and treats rhyme as something that only earns its place when it appears
  // naturally rather than being forced.
  const rhymeInstruction =
    params.creativityLevel <= 3
      ? "Write with a clear, consistent rhyme scheme (e.g. couplets AABB or alternating ABAB) where it fits naturally. Prioritize rhyme — deviate only when a line would be clearly worse for it."
      : params.creativityLevel >= 8
        ? "Treat rhyme as optional: never sacrifice meaning, imagery or authenticity for a rhyme. When a good rhyme lands naturally, take it; otherwise leave the scheme open."
        : "Favor rhyme where it lands naturally — take a good rhyme when it fits without forcing the wording, and skip it when forcing one would cost authenticity.";

  // Verses breathe: the model picks 4 or 8 lines per section instead of the
  // per-block fixed count. Everything else keeps the exact-line contract —
  // performer tags and blank lines still don't count as lyric lines.
  const lineCountInstruction =
    params.blockType === "verse"
      ? "The section must contain either 4 or 8 lyric lines — choose whichever serves this verse best, then commit to it. Count only sung lyric lines; performer tags like [male] and blank lines don't count."
      : `The section must contain exactly ${params.lineCount} lyric lines — no more, no fewer. Count only sung lyric lines; performer tags like [male] and blank lines don't count.`;

  let chorusInstruction = "";
  if (params.blockType === "chorus") {
    if (params.chorusMode === "repeat") {
      chorusInstruction = params.isFirstChorus
        ? "Write one definitive, memorable chorus that can be repeated verbatim later in the song."
        : "Keep this chorus extremely close to the first chorus and preserve the exact hook phrasing.";
    } else if (params.chorusMode === "variation") {
      chorusInstruction = params.isFirstChorus
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
Avoid AI songwriting clichés: stock breakup/nostalgia props like "your coat still on my chair", "half-empty cups gone cold", cold coffee, unmade beds, ticking clocks, or fading photographs. If the topic calls for that kind of imagery, find a detail specific to this song's actual topic and mood instead of reaching for the generic default
${buildAvoidWordsInstruction()}
Chorus lines should be punchy and memorable — build around one crucial, hook-worthy line rather than several competing ideas
Bridge should contrast emotionally with the verses
Return only the raw lyric text, nothing else`;

  // Everything here is a property of the SONG, not of the section being written:
  // the same strings are sent for every block of the same song, in the same
  // order, which is what makes the provider's prefix cache hit. Sections are
  // appended (never re-ordered) and the closing marker lives in the per-section
  // part below, so a longer context still *extends* the previous prefix.
  const cacheablePrefix = [
    `Write one section of this song. Song-level direction (applies to every section):`,
    `Topic: ${params.topic}`,
    `Mood/Vibe: ${params.mood}`,
    `Language: ${params.language}`,
    styleText ? `Style/Genre: ${styleText}` : "",
    !fixedVocalTag && params.performerDirections ? `Performer direction: ${params.performerDirections}` : "",
    params.vocalistTag === "duet" ? `Vocalist tag: [duet]` : "",
    literalnessInstruction,
    rhymeInstruction,
    performerTagInstruction,
    context ? `--- EXISTING SECTIONS (for context and coherence) ---\n${context}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    context ? "--- END CONTEXT ---" : "",
    `Now write only the lyrics for: ${params.blockLabel} (${params.blockType})`,
    lineCountInstruction,
    chorusInstruction ? `Chorus instruction: ${chorusInstruction}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { systemPrompt, cacheablePrefix, userPrompt };
}
