/**
 * SearchService — search and replace over lyric text fields only.
 *
 * Timestamps are NEVER searched or replaced.
 * Only the `text` property of each LyricLine is involved.
 */

import type { LyricLine } from "./LyricsParser";

export interface SearchOptions {
  caseSensitive?: boolean;
  useRegex?: boolean;
}

export interface SearchMatch {
  lineId: number;
  /** Zero-based character index of the match start within line.text */
  start: number;
  /** Zero-based character index of the match end (exclusive) */
  end: number;
  /** The matched substring */
  match: string;
}

function buildPattern(query: string, options: SearchOptions): RegExp | null {
  if (!query) return null;
  try {
    const flags = options.caseSensitive ? "g" : "gi";
    const pattern = options.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(pattern, flags);
  } catch {
    return null; // invalid regex — treat as no match
  }
}

/**
 * Find all matches of `query` in the lyric text fields of `lines`.
 * Returns an array of SearchMatch objects ordered by lineId then position.
 */
export function search(
  lines: LyricLine[],
  query: string,
  options: SearchOptions = {}
): SearchMatch[] {
  const regex = buildPattern(query, options);
  if (!regex) return [];

  const results: SearchMatch[] = [];

  for (const line of lines) {
    regex.lastIndex = 0; // reset global regex
    let m: RegExpExecArray | null;
    while ((m = regex.exec(line.text)) !== null) {
      results.push({
        lineId: line.id,
        start: m.index,
        end: m.index + m[0].length,
        match: m[0],
      });
      // Prevent infinite loop on zero-length matches
      if (m[0].length === 0) regex.lastIndex++;
    }
  }

  return results;
}

/**
 * Replace the first occurrence of `from` in the line that contains `match`,
 * returning a new LyricLine[].
 */
export function replace(
  lines: LyricLine[],
  match: SearchMatch,
  replacement: string
): LyricLine[] {
  return lines.map((line) => {
    if (line.id !== match.lineId) return line;
    const newText =
      line.text.slice(0, match.start) +
      replacement +
      line.text.slice(match.end);
    return { ...line, text: newText };
  });
}

/**
 * Replace ALL occurrences of `from` across all lines, returning a new LyricLine[].
 */
export function replaceAll(
  lines: LyricLine[],
  query: string,
  replacement: string,
  options: SearchOptions = {}
): LyricLine[] {
  const regex = buildPattern(query, options);
  if (!regex) return lines;

  return lines.map((line) => {
    regex.lastIndex = 0;
    const newText = line.text.replace(regex, replacement);
    if (newText === line.text) return line;
    return { ...line, text: newText };
  });
}
