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

export interface LyricBlock {
  id: string;
  type: BlockType;
  label: string;
  content: string;
  generating: boolean;
  uniqueChorusOverride: boolean;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  intro: "Intro",
  verse: "Verse",
  "pre-chorus": "Pre-Chorus",
  chorus: "Chorus",
  "post-chorus": "Post-Chorus",
  bridge: "Bridge",
  intrumental: "intrumental",
  "instrumetal-drop": "instrumetal drop",
  outro: "Outro",
};

export function isEmptyLyricBlockType(type: BlockType): boolean {
  return type === "intrumental" || type === "instrumetal-drop";
}

export function isDancePreset(presetName?: string): boolean {
  return Boolean(
    presetName?.startsWith("EDM") ||
      presetName?.startsWith("Dance") ||
      presetName?.startsWith("Minimal")
  );
}

export function getPresetBlockLabel(type: BlockType, presetName?: string): string {
  if (!isDancePreset(presetName)) return BLOCK_LABELS[type];
  if (type === "chorus") return "Drop";
  if (type === "bridge") return "Breakdown";
  if (type === "pre-chorus") return "Build-up";
  return BLOCK_LABELS[type];
}

export function parseStructureText(text: string): BlockType[] {
  const normalized = text.toLowerCase();
  const matches = normalized.match(/pre[-\s]?chorus|post[-\s]?chorus|build[-\s]?up|instrumental[-\s]?drop|instrumetal[-\s]?drop|intro|verse|chorus|bridge|outro|drop|build|break|instrumental|intrumental/g);
  if (!matches) return [];

  return matches.map((match) => {
    if (match.includes("instrumental") || match.includes("intrumental")) {
      if (match.includes("drop")) return "instrumetal-drop";
      return "intrumental";
    }
    if (match.includes("pre") || match.includes("build")) return "pre-chorus";
    if (match.includes("post")) return "post-chorus";
    if (match.includes("drop") || match.includes("chorus")) return "chorus";
    if (match.includes("break") || match.includes("bridge")) return "bridge";
    if (match.includes("intro")) return "intro";
    if (match.includes("outro")) return "outro";
    return "verse";
  });
}

export function createBlock(type: BlockType, label?: string): LyricBlock {
  return {
    id: crypto.randomUUID(),
    type,
    label: label || BLOCK_LABELS[type],
    content: "",
    generating: false,
    uniqueChorusOverride: false,
  };
}

export function createPresetBlocks(types: BlockType[], presetName?: string): LyricBlock[] {
  const totalByLabel = types.reduce<Record<string, number>>((counts, type) => {
    const label = getPresetBlockLabel(type, presetName);
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});

  const seenByLabel: Record<string, number> = {};

  return types.map((type) => {
    const baseLabel = getPresetBlockLabel(type, presetName);
    seenByLabel[baseLabel] = (seenByLabel[baseLabel] || 0) + 1;
    const label = totalByLabel[baseLabel] > 1 ? `${baseLabel} ${seenByLabel[baseLabel]}` : baseLabel;
    return createBlock(type, label);
  });
}

export function combineLyrics(blocks: LyricBlock[]): string {
  return blocks
    .filter((block) => isEmptyLyricBlockType(block.type) || block.content.trim())
    .map((block) => {
      const label = block.label.trim() || BLOCK_LABELS[block.type];
      if (isEmptyLyricBlockType(block.type)) return `[${label}]`;
      return `[${label}]\n${block.content.trim()}`;
    })
    .join("\n\n");
}

export function autoGrowTextarea(element: HTMLTextAreaElement): void {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}
