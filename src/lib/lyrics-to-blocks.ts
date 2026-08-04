import { BLOCK_LABELS, type BlockType, type LyricBlock, createBlock, isEmptyLyricBlockType } from "@/lib/lyrics-utils";

function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerToBlockType(header: string): { type: BlockType; label: string } {
  const normalized = normalizeHeader(header);

  if (normalized.includes("pre") && normalized.includes("chorus")) {
    return { type: "pre-chorus", label: header };
  }
  if (normalized.includes("post") && normalized.includes("chorus")) {
    return { type: "post-chorus", label: header };
  }
  if (normalized.includes("pre-chorus") || normalized.includes("pre chorus") || normalized.includes("build-up") || normalized.includes("buildup")) {
    return { type: "pre-chorus", label: header };
  }
  if (normalized.includes("post-chorus") || normalized.includes("post chorus")) {
    return { type: "post-chorus", label: header };
  }
  if (normalized.includes("instrumental drop") || normalized.includes("instrumetal drop")) {
    return { type: "instrumetal-drop", label: header };
  }
  if (normalized.includes("instrumental") || normalized.includes("intrumental") || normalized.includes("interlude")) {
    return { type: "intrumental", label: header };
  }
  if (normalized.includes("hook")) {
    return { type: "chorus", label: header };
  }
  if (normalized.includes("chorus") || normalized.includes("refrain")) {
    return { type: "chorus", label: header };
  }
  if (normalized.includes("bridge") || normalized.includes("break")) {
    return { type: "bridge", label: header };
  }
  if (normalized.includes("outro") || normalized.includes("ending")) {
    return { type: "outro", label: header };
  }
  if (normalized.includes("intro") || normalized.includes("opening")) {
    return { type: "intro", label: header };
  }
  const verseMatch = normalized.match(/^verse\s*(\d+)?$/) || normalized.match(/^v\s*(\d+)?$/);
  if (verseMatch) {
    const num = verseMatch[1];
    return { type: "verse", label: num ? `Verse ${num}` : header };
  }
  return { type: "verse", label: header };
}

const SECTION_HEADER_RE = /^\s*\[[^\]]+\]\s*$/;

export function parseLyricsToBlocks(lyrics: string): LyricBlock[] {
  if (!lyrics || !lyrics.trim()) return [];

  const lines = lyrics.split("\n");
  const sections: Array<{ header: string | null; content: string[] }> = [];
  let current: { header: string | null; content: string[] } = { header: null, content: [] };

  for (const line of lines) {
    if (SECTION_HEADER_RE.test(line)) {
      if (current.header !== null || current.content.length > 0) {
        sections.push(current);
      }
      current = { header: line.replace(/[\[\]]/g, "").trim(), content: [] };
    } else {
      current.content.push(line);
    }
  }
  if (current.header !== null || current.content.length > 0) {
    sections.push(current);
  }

  if (sections.length === 0) {
    return [createBlock("verse", undefined)];
  }

  const blocks: LyricBlock[] = [];
  let verseCounter = 0;

  for (const section of sections) {
    const content = section.content.join("\n").trim();
    if (section.header === null) {
      if (content) {
        verseCounter += 1;
        blocks.push({ ...createBlock("verse", `Verse ${verseCounter}`), content });
      }
      continue;
    }

    const { type, label } = headerToBlockType(section.header);

    if (type === "verse") {
      const numMatch = label.match(/(\d+)/);
      if (numMatch) {
        verseCounter = Math.max(verseCounter, parseInt(numMatch[1], 10));
      } else {
        verseCounter += 1;
      }
    }

    blocks.push({ ...createBlock(type, label), content });
  }

  return blocks.length > 0 ? blocks : [createBlock("verse", undefined)];
}

export function lyricsHaveSectionHeaders(lyrics: string): boolean {
  if (!lyrics) return false;
  return SECTION_HEADER_RE.test(lyrics.split("\n").find((l) => l.trim()) || "");
}
