import type { LyricStudioSnapshot } from "@/lib/lyrics-studio-types";
import type { BlockType, LyricBlock } from "@/lib/lyrics-utils";

export type LyricsStudioDraftPayload = {
  topic: string;
  mood: string;
  style: string;
  vocalistTag: "auto" | "male" | "female" | "together";
  performerDirections: string;
  blocks: LyricBlock[];
  activePreset: string;
  lyricCols: number;
  showLyricsSidebar: boolean;
  structure: string;
  customStructure: string;
  language: string;
  customLanguage: string;
  repetitiveChorus: boolean;
  creativityLevel: number;
  contextLevel: number;
  styleSuggestion: string;
};

export function buildLyricsStudioDraftPayload(payload: LyricsStudioDraftPayload): LyricsStudioDraftPayload {
  return {
    topic: payload.topic,
    mood: payload.mood,
    style: payload.style,
    vocalistTag: payload.vocalistTag,
    performerDirections: payload.performerDirections,
    blocks: payload.blocks,
    activePreset: payload.activePreset,
    lyricCols: payload.lyricCols,
    showLyricsSidebar: payload.showLyricsSidebar,
    structure: payload.structure,
    customStructure: payload.customStructure,
    language: payload.language,
    customLanguage: payload.customLanguage,
    repetitiveChorus: payload.repetitiveChorus,
    creativityLevel: payload.creativityLevel,
    contextLevel: payload.contextLevel,
    styleSuggestion: payload.styleSuggestion,
  };
}

export function sanitizeLyricBlocksForLoad(
  input: LyricBlock[],
  validTypes: BlockType[],
  blockLabels: Record<BlockType, string>
): LyricBlock[] {
  const validTypeSet = new Set<BlockType>(validTypes);

  return (input || [])
    .filter((block) => !!block && validTypeSet.has(block.type))
    .map((block, index) => ({
      id: typeof block.id === "string" && block.id.trim() ? block.id : `loaded-${index}-${crypto.randomUUID()}`,
      type: block.type,
      label: typeof block.label === "string" && block.label.trim() ? block.label : blockLabels[block.type],
      content: typeof block.content === "string" ? block.content : "",
      generating: false,
      uniqueChorusOverride:
        block.type === "chorus" && typeof block.uniqueChorusOverride === "boolean"
          ? block.uniqueChorusOverride
          : false,
    }));
}

export function parseSavedLyricsSnapshots(raw: string | null): LyricStudioSnapshot[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => {
      return (
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.createdAt === "string" &&
        item.payload &&
        typeof item.payload === "object"
      );
    }) as LyricStudioSnapshot[];
  } catch {
    return [];
  }
}
