/**
 * LyricsParser — converts raw LRC-format text into a structured LyricLine[].
 *
 * Format handled:
 *   [MM:SS.mmm]          ← timestamp line  (2 or 3 decimal places)
 *   Lyric text here      ← one or more lyric lines
 *
 *   [MM:SS.mmm]
 *   Next lyric
 *
 * Timestamps are NEVER mutated — they are stored exactly as they appear.
 */

export interface LyricLine {
  /** Stable 1-indexed identifier, never changes for the lifetime of the session. */
  id: number;
  /** The full bracket-wrapped timestamp string, e.g. "[00:08.320]". Immutable. */
  timestamp: string;
  /** Editable lyric text. May contain newlines for multi-line entries. */
  text: string;
}

/** Matches [MM:SS.mm] or [MM:SS.mmm] — captures just the inner time string. */
const TIMESTAMP_RE = /^\[(\d{2}:\d{2}\.\d{2,3})\]$/;

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Parse raw timecoded-lyric text into LyricLine[].
 * Blocks are separated by blank lines; each block must start with a timestamp line.
 * Throws ParseError if the input contains no valid blocks.
 */
export function parseLyrics(raw: string): LyricLine[] {
  // Normalise line endings
  const normalised = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Split into blocks on one or more blank lines
  const blocks = normalised.split(/\n{2,}/);

  const lines: LyricLine[] = [];
  let id = 1;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const blockLines = trimmed.split("\n");
    const firstLine = blockLines[0].trim();

    const tsMatch = TIMESTAMP_RE.exec(firstLine);
    if (!tsMatch) {
      // Skip blocks that don't start with a valid timestamp (e.g. headers/comments)
      continue;
    }

    // Preserve the original full bracket form: "[MM:SS.mmm]"
    const timestamp = firstLine; // already in "[MM:SS.xxx]" form
    // Everything after the first line is lyric text (may be multi-line)
    const text = blockLines.slice(1).join("\n").trim();

    lines.push({ id: id++, timestamp, text });
  }

  if (lines.length === 0) {
    throw new ParseError(
      "No valid timecoded blocks found. " +
      "Expected format:\n[MM:SS.mmm]\nLyric text"
    );
  }

  return lines;
}

/**
 * Returns true if the raw string looks like it might be valid timecoded lyrics.
 * Used for quick validation before attempting a full parse.
 */
export function looksLikeTimecodedLyrics(raw: string): boolean {
  return /\[\d{2}:\d{2}\.\d{2,3}\]/.test(raw);
}
