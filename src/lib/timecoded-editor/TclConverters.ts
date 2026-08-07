/**
 * Bridges the generic TclDocument format to the existing editor's
 * line-only LyricLine[] model, so EditorTable/AIToolbar/HistoryManager/
 * SearchService keep working completely unchanged.
 *
 * Word-level timing only exists per-line in the original TclDocument.
 * Editing a line's text here has no way to re-time individual words (that's
 * a later-phase "regenerate this line" feature), so any line whose text no
 * longer matches its original alignment loses its word[] array — callers
 * must surface `dirtyLineIds` to the user rather than let this happen silently.
 */

import type { LyricLine } from "./LyricsParser";
import type { TclDocument, TclLine } from "@/lib/tcl/types";

function formatBracketTimestamp(seconds: number): string {
  const clamped = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `[${String(mm).padStart(2, "0")}:${ss.toFixed(3).padStart(6, "0")}]`;
}

export function tclToLyricLines(doc: TclDocument): LyricLine[] {
  return doc.lines.map((line, index) => ({
    id: index + 1,
    timestamp: formatBracketTimestamp(line.start),
    text: line.text,
  }));
}

export interface TclConversionResult {
  doc: TclDocument;
  /** LyricLine ids whose word-level timing was cleared because the text changed. */
  dirtyLineIds: Set<number>;
}

export function lyricLinesToTcl(lines: LyricLine[], originalDoc: TclDocument): TclConversionResult {
  const dirtyLineIds = new Set<number>();

  const newLines: TclLine[] = lines.map((line) => {
    const original: TclLine | undefined = originalDoc.lines[line.id - 1];

    if (!original) {
      // Line has no corresponding entry in the original alignment (e.g. added via AI/import).
      dirtyLineIds.add(line.id);
      return { start: 0, end: 0, text: line.text, words: [] };
    }

    const textChanged = line.text.trim() !== original.text.trim();
    if (textChanged) {
      dirtyLineIds.add(line.id);
      return { start: original.start, end: original.end, text: line.text, words: [] };
    }

    return { start: original.start, end: original.end, text: line.text, words: original.words };
  });

  return { doc: { version: 1, lines: newLines }, dirtyLineIds };
}
