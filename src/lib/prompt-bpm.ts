/**
 * Prompts often state the tempo the writer asked for ("slow 3/4 at 85 BPM").
 * The detector reports the pulse it actually hears, and on half-time, trap and
 * waltz material those two disagree by an octave — measured 68 for a 136 BPM
 * half-time groove, or 118 for a 58 BPM waltz whose eighth notes are that fast.
 *
 * Neither number is wrong: the measurement is what the track feels like, the
 * prompt is the grid it was written on. Parsing the promise next to the
 * measurement keeps both facts visible instead of bending the measurement
 * towards the prompt, which would only make the number agree with itself.
 */

/**
 * Two digits minimum, so years and channel counts ("24 bit") cannot slip in,
 * and a word boundary after "bpm" so "bpm-ish" still reads as a tempo.
 */
const PROMPT_BPM_PATTERN = /\b(\d{2,3})\s*bpm\b/i;

/** Outside this range it is a typo, not a tempo. */
const MIN_PLAUSIBLE_BPM = 40;
const MAX_PLAUSIBLE_BPM = 220;

export function parsePromptBpm(prompt: string | null | undefined): number | null {
  if (!prompt) return null;

  const match = PROMPT_BPM_PATTERN.exec(prompt);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_PLAUSIBLE_BPM || value > MAX_PLAUSIBLE_BPM) return null;

  return value;
}

/**
 * - `aligned`: the measurement sits on the promised grid.
 * - `half`: the measurement is half the promise (half-time, trap, 808s).
 * - `double`: the measurement is twice the promise (a waltz whose eighth notes
 *   are what the beat tracker locks onto).
 */
export type TempoOctaveRelation = "aligned" | "half" | "double";

/** Loose enough for a rounded prompt and a detector that reports whole BPM. */
const OCTAVE_TOLERANCE = 0.05;

export function tempoOctaveRelation(
  measured: number | null | undefined,
  intended: number | null | undefined,
): TempoOctaveRelation | null {
  if (measured == null || intended == null) return null;
  if (!Number.isFinite(measured) || !Number.isFinite(intended)) return null;
  if (measured <= 0 || intended <= 0) return null;

  const close = (candidate: number) => Math.abs(candidate - intended) / intended <= OCTAVE_TOLERANCE;

  if (close(measured)) return "aligned";
  if (close(measured * 2)) return "half";
  if (close(measured / 2)) return "double";

  // Not an octave apart: the tracker disagrees about more than the level, which
  // is a different (and rarer) problem than the one this module describes.
  return null;
}
