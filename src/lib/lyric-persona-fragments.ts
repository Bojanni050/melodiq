import {
  hashText,
  normalizeFragmentText,
  type LyricPersonaFragment,
  type LyricPersonaFragmentKind,
} from "@/lib/lyric-personas";

/**
 * Turns a saved lyric text into persona material.
 *
 * Two shapes are supported:
 *  - Suno/MelodIQ style with section headers (`[Verse 1]`, `Chorus`, `Refrein`);
 *  - plain lyrics without headers, where stanzas that repeat are treated as
 *    choruses and the rest as verses.
 *
 * Couplets are four-line blocks (or the whole stanza when it is shorter than
 * four lines) from non-chorus sections; choruses are complete chorus sections.
 * The result is deliberately small and deterministic so the same library
 * always yields the same candidate pool.
 */

const HEADER_PATTERN =
  /^[\[(]?\s*(intro|verse|couplet|pre[\s-]?chorus|post[\s-]?chorus|chorus|refrein|hook|bridge|outro|drop|build[\s-]?up|instrumental|interlude)(?:\s*\d+)?(?:\s*[|\-–—:].*)?\s*[\])]?\s*$/i;

const CHORUS_HEADERS = new Set(["chorus", "refrein", "hook", "post-chorus", "postchorus", "post chorus"]);
const MAX_COUPLETS_PER_SOURCE = 8;
const MAX_CHORUSES_PER_SOURCE = 4;
const MIN_FRAGMENT_LINES = 4;
const MAX_FRAGMENT_LINES = 8;

interface RawSection {
  kind: "chorus" | "other";
  stanzas: string[][];
}

function headerType(line: string): "chorus" | "other" | null {
  const match = HEADER_PATTERN.exec(line.trim());
  if (!match) return null;
  const name = match[1].toLowerCase().replace(/\s+/g, " ");
  return CHORUS_HEADERS.has(name) ? "chorus" : "other";
}

function isPerformerTagOnly(line: string): boolean {
  return /^\[[^\]]+\]$/.test(line.trim());
}

function cleanStanza(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isPerformerTagOnly(line));
}

function hasSubstance(lines: string[]): boolean {
  return lines.some((line) => line.replace(/[^\p{L}\p{N}]/gu, "").length >= 2);
}

function pushSection(sections: RawSection[], kind: "chorus" | "other", lines: string[]) {
  const stanzas: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      if (current.length > 0) {
        stanzas.push(cleanStanza(current));
        current = [];
      }
      continue;
    }
    const type = headerType(line);
    // A header inside a section means the previous one was the section start;
    // this only happens with malformed input, so treat it as an implicit break.
    if (type) {
      if (current.length > 0) {
        stanzas.push(cleanStanza(current));
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) stanzas.push(cleanStanza(current));

  const nonEmpty = stanzas.filter((stanza) => stanza.length > 0);
  if (nonEmpty.length > 0) sections.push({ kind, stanzas: nonEmpty });
}

function parseSections(lyrics: string): RawSection[] {
  const lines = lyrics.replace(/\r\n/g, "\n").split("\n");
  const hasHeaders = lines.some((line) => headerType(line) !== null);

  if (hasHeaders) {
    const sections: RawSection[] = [];
    let currentKind: "chorus" | "other" = "other";
    let currentLines: string[] = [];

    for (const line of lines) {
      const type = headerType(line);
      if (type) {
        pushSection(sections, currentKind, currentLines);
        currentKind = type;
        currentLines = [];
        continue;
      }
      currentLines.push(line);
    }
    pushSection(sections, currentKind, currentLines);
    return sections;
  }

  // No headers: blank lines delimit stanzas. A stanza that appears more than
  // once is the chorus, because repetition is what makes it one.
  const stanzaTexts: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length > 0) {
        stanzaTexts.push(current.join("\n"));
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) stanzaTexts.push(current.join("\n"));

  const counts = new Map<string, number>();
  for (const stanza of stanzaTexts) {
    const key = normalizeFragmentText(stanza).toLowerCase();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }

  return stanzaTexts.map((stanza) => ({
    kind: (counts.get(normalizeFragmentText(stanza).toLowerCase()) || 0) >= 2 ? "chorus" : "other",
    stanzas: [cleanStanza(stanza.split("\n"))].filter((s) => s.length > 0),
  }));
}

export function extractPromotedFragments(lyrics: string, sourceTitle = ""): LyricPersonaFragment[] {
  const text = typeof lyrics === "string" ? lyrics.trim() : "";
  if (!text) return [];

  const fragments: LyricPersonaFragment[] = [];
  const seen = new Set<string>();
  let coupletCount = 0;
  let chorusCount = 0;

  const add = (kind: LyricPersonaFragmentKind, rawText: string) => {
    const normalized = normalizeFragmentText(rawText);
    if (!normalized) return;
    const key = `${kind}:${normalized.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    fragments.push({
      id: `frag-${hashText(key)}`,
      kind,
      text: normalized,
      sourceTitle: sourceTitle.trim(),
    });
  };

  for (const section of parseSections(text)) {
    if (coupletCount >= MAX_COUPLETS_PER_SOURCE) break;

    for (const stanza of section.stanzas) {
      if (section.kind === "chorus") {
        if (chorusCount < MAX_CHORUSES_PER_SOURCE && hasSubstance(stanza)) {
          add("chorus", stanza.slice(0, MAX_FRAGMENT_LINES).join("\n"));
          chorusCount++;
        }
        continue;
      }

      // A stanza shorter than four lines is used whole (there is nothing more
      // to take). Longer stanzas are split into non-overlapping four-line
      // blocks, so a leftover of one to three lines is dropped.
      const chunks: string[][] =
        stanza.length <= MAX_FRAGMENT_LINES
          ? [stanza]
          : Array.from(
              { length: Math.floor(stanza.length / MIN_FRAGMENT_LINES) },
              (_, index) =>
                stanza.slice(index * MIN_FRAGMENT_LINES, (index + 1) * MIN_FRAGMENT_LINES)
            );

      for (const chunk of chunks) {
        if (coupletCount >= MAX_COUPLETS_PER_SOURCE) break;
        if (!hasSubstance(chunk)) continue;
        add("couplet", chunk.join("\n"));
        coupletCount++;
      }
    }
  }

  return fragments;
}

export interface PickRandomFragmentsOptions {
  limit?: number;
  coupletLimit?: number;
  chorusLimit?: number;
  excludeIds?: string[];
  /** Injectable for deterministic tests. */
  random?: () => number;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Picks a fresh batch for the persona picker: mostly couplets, a few choruses,
 * never anything the caller already has, and filled up from whatever is left
 * when one kind runs out.
 */
export function pickRandomFragments(
  candidates: LyricPersonaFragment[],
  options: PickRandomFragmentsOptions = {}
): LyricPersonaFragment[] {
  const limit = Math.max(1, Math.min(40, options.limit ?? 24));
  const coupletLimit = Math.max(0, options.coupletLimit ?? 18);
  const chorusLimit = Math.max(0, options.chorusLimit ?? 6);
  const excludedIds = new Set(options.excludeIds || []);
  const random = options.random || Math.random;

  // Copies of an excluded fragment (same text, another id) have to be excluded
  // too, otherwise the picker would hand back a line the persona already has.
  const excludedTexts = new Set(
    candidates
      .filter((candidate) => excludedIds.has(candidate.id))
      .map((candidate) => `${candidate.kind}:${normalizeFragmentText(candidate.text).toLowerCase()}`)
  );

  const unique: LyricPersonaFragment[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const text = normalizeFragmentText(candidate.text);
    if (!text) continue;
    const key = `${candidate.kind}:${text.toLowerCase()}`;
    if (excludedIds.has(candidate.id) || excludedTexts.has(key) || seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...candidate, text });
  }

  const couplets = shuffle(unique.filter((f) => f.kind === "couplet"), random);
  const choruses = shuffle(unique.filter((f) => f.kind === "chorus"), random);

  const picked = [
    ...couplets.slice(0, coupletLimit),
    ...choruses.slice(0, chorusLimit),
  ];

  if (picked.length < limit) {
    const pickedIds = new Set(picked.map((f) => f.id));
    const leftovers = shuffle(
      unique.filter((f) => !pickedIds.has(f.id)),
      random
    );
    picked.push(...leftovers.slice(0, limit - picked.length));
  }

  return shuffle(picked.slice(0, limit), random);
}
