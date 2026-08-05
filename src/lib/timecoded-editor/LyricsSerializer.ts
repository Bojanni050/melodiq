/**
 * LyricsSerializer — converts a LyricLine[] back into the canonical LRC text.
 *
 * GUARANTEE: timestamps are written exactly as they were parsed — no reformatting,
 * no rounding, no zero-padding changes. The timestamp string is byte-for-byte identical.
 */

import type { LyricLine } from "./LyricsParser";

/**
 * Serialise a LyricLine[] back to the original LRC format.
 * Blocks are separated by a blank line.
 *
 * Output for each line:
 *   [MM:SS.mmm]
 *   Lyric text
 *
 * (If text is empty the lyric line is omitted but the timestamp is still written.)
 */
export function serializeLyrics(lines: LyricLine[]): string {
  return lines
    .map((line) => {
      // timestamp is already the full "[MM:SS.mmm]" string — write it verbatim
      if (!line.text.trim()) {
        // Preserve empty-text lines — some formats use bare timestamps as markers
        return line.timestamp;
      }
      return `${line.timestamp}\n${line.text}`;
    })
    .join("\n\n");
}
