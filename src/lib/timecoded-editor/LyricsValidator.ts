/**
 * LyricsValidator — validates AI edit patches before they touch the lyric structure.
 *
 * The AI is NEVER trusted. Every patch is validated against the current line set.
 * Any violation throws a ValidationError and the original structure is kept intact.
 */

import type { LyricLine } from "./LyricsParser";

export interface AILinePatch {
  lineId: number;
  text: string;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "EMPTY_PATCH"
      | "INVALID_PATCH_SHAPE"
      | "UNKNOWN_LINE_ID"
      | "DUPLICATE_LINE_ID"
      | "INVALID_TEXT_TYPE"
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate an AI patch array against the current lines.
 *
 * Rules:
 *  1. Patch must be a non-empty array
 *  2. Each entry must have numeric lineId and string text
 *  3. No duplicate lineIds in the patch
 *  4. Every lineId must exist in currentLines
 *
 * @returns The validated patch (same array, type-narrowed)
 * @throws ValidationError on any violation
 */
export function validatePatch(
  patch: unknown,
  currentLines: LyricLine[]
): AILinePatch[] {
  // Rule 1: must be a non-empty array
  if (!Array.isArray(patch) || patch.length === 0) {
    throw new ValidationError(
      "AI returned an empty or invalid patch. No changes were applied.",
      "EMPTY_PATCH"
    );
  }

  const validIds = new Set(currentLines.map((l) => l.id));
  const seenIds = new Set<number>();
  const validated: AILinePatch[] = [];

  for (let i = 0; i < patch.length; i++) {
    const entry = patch[i];

    // Rule 2: shape check
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as Record<string, unknown>).lineId !== "number" ||
      typeof (entry as Record<string, unknown>).text !== "string"
    ) {
      throw new ValidationError(
        `AI patch entry at index ${i} is malformed. Expected { lineId: number, text: string }.`,
        "INVALID_PATCH_SHAPE"
      );
    }

    const { lineId, text } = entry as AILinePatch;

    // Rule 3: no duplicates
    if (seenIds.has(lineId)) {
      throw new ValidationError(
        `AI patch contains duplicate lineId: ${lineId}. No changes were applied.`,
        "DUPLICATE_LINE_ID"
      );
    }
    seenIds.add(lineId);

    // Rule 4: lineId must exist
    if (!validIds.has(lineId)) {
      throw new ValidationError(
        `AI patch references unknown lineId: ${lineId}. No changes were applied.`,
        "UNKNOWN_LINE_ID"
      );
    }

    validated.push({ lineId, text });
  }

  return validated;
}

/**
 * Apply a validated patch to the current lines, returning a new array.
 * Timestamps are NEVER touched — only the text field is updated.
 */
export function applyPatch(
  currentLines: LyricLine[],
  patch: AILinePatch[]
): LyricLine[] {
  const patchMap = new Map(patch.map((p) => [p.lineId, p.text]));
  return currentLines.map((line) => {
    if (patchMap.has(line.id)) {
      return { ...line, text: patchMap.get(line.id)! };
    }
    return line;
  });
}
