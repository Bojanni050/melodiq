/**
 * How a trait is shown: its state, its trend and the counters above the list.
 *
 * The stored trait carries a number (confidence) and two timestamps; the
 * vocabulary the UI needs ("still learning", "changed this week", "you pinned
 * this") is derived here instead of being stored, so changing a threshold is a
 * code change and not a migration.
 */

/** A change inside this window makes the trait pulse in the UI. */
export const PULSE_WINDOW_DAYS = 7;

/** Above this confidence a trait reads as settled rather than "still learning". */
export const SURE_CONFIDENCE = 0.5;

/** How many recent changes decide the trend direction. */
const TREND_WINDOW = 3;

export type TraitState = "dark" | "learning" | "sure" | "pulsing" | "locked";

export type TraitStateInput = {
  confidence: number;
  lockedAt: Date | null;
  lastChangedAt: Date | null;
};

const DAY_MS = 86_400_000;

export function isPulsing(lastChangedAt: Date | null, options: { now: Date }): boolean {
  if (!lastChangedAt) return false;
  const age = options.now.getTime() - lastChangedAt.getTime();
  return age >= 0 && age < PULSE_WINDOW_DAYS * DAY_MS;
}

/**
 * Precedence is deliberate: a lock outranks everything (the user decided), a
 * recent change outranks confidence (something moved worth looking at), and only
 * then does certainty decide between "sure" and "still learning".
 */
export function traitState(trait: TraitStateInput | null, options: { now: Date }): TraitState {
  if (!trait) return "dark";
  if (trait.lockedAt) return "locked";
  if (isPulsing(trait.lastChangedAt, options)) return "pulsing";
  return trait.confidence >= SURE_CONFIDENCE ? "sure" : "learning";
}

/** Newest first, as the history table is read. Non-numeric changes are ignored. */
export function traitTrend(changes: { direction: string }[]): "up" | "down" | "steady" {
  const directions = changes
    .slice(0, TREND_WINDOW)
    .map((change) => change.direction)
    .filter((direction) => direction === "up" || direction === "down");
  const up = directions.filter((direction) => direction === "up").length;
  const down = directions.length - up;
  if (up === down) return "steady";
  return up > down ? "up" : "down";
}

export type ProfileSignals = {
  songs: number;
  edits: number;
  calibrations: number;
  /** "1200 songs · 0 edits · 2 calibrations" — the line above the trait list. */
  label: string;
};

/**
 * The three counters the profile header shows. "Edits" are the user's own
 * corrections; a `reset` only undoes one, so it is not counted as a signal.
 * Calibration duels live in their own table, one row per answered pair.
 */
export function profileSignals(input: {
  sourceCount: number;
  feedbackKinds: string[];
  calibrationAnswers: number;
}): ProfileSignals {
  const songs = Math.max(0, Math.round(input.sourceCount));
  const edits = input.feedbackKinds.filter((kind) => kind !== "reset").length;
  const calibrations = Math.max(0, Math.round(input.calibrationAnswers));
  return { songs, edits, calibrations, label: `${songs} songs · ${edits} edits · ${calibrations} calibrations` };
}
