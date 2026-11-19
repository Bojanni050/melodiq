/**
 * How a generation started, as the Studio saw it.
 *
 * The Studio is a single form: there is no "simple" and "advanced" screen to
 * read a mode from, so the client records what actually happened — where the
 * prompt came from, whether an advanced control was touched, and whether the
 * prompt or lyrics were edited before generating. Shared with the API route so
 * the body is validated in one place instead of trusted as-is.
 *
 * Pure and React-free on purpose: the store imports it and the aggregator only
 * sees the resulting events.
 */
export const HABIT_ORIGINS = ["scratch", "saved_lyrics", "preset", "reuse"] as const;

export type HabitOrigin = (typeof HABIT_ORIGINS)[number];

export const HABIT_MODES = ["simple", "advanced"] as const;

export type HabitMode = (typeof HABIT_MODES)[number];

export type HabitSnapshot = {
  origin: HabitOrigin;
  mode: HabitMode;
  edited: boolean;
};

/**
 * Human label per origin. Used as the trait's value, so it stays a short noun
 * phrase rather than a sentence: "Reused prompt 67%".
 */
export const HABIT_ORIGIN_LABELS: Record<HabitOrigin, string> = {
  scratch: "Blank prompt",
  saved_lyrics: "Saved lyric",
  preset: "Preset",
  reuse: "Reused prompt",
};

export function isHabitOrigin(value: unknown): value is HabitOrigin {
  return typeof value === "string" && (HABIT_ORIGINS as readonly string[]).includes(value);
}

export function isHabitMode(value: unknown): value is HabitMode {
  return typeof value === "string" && (HABIT_MODES as readonly string[]).includes(value);
}

/**
 * Validates the `habit` field of a generation request.
 *
 * Returns null for a missing or unusable field: an API client that never sends
 * one simply contributes no habit event, instead of producing a row that says
 * "blank prompt, simple" for something it never claimed. Origin is the one
 * field without a safe default; mode and edited fall back to their defaults so
 * a partial object from an older client still counts.
 */
export function parseHabit(value: unknown): HabitSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!isHabitOrigin(record.origin)) return null;

  return {
    origin: record.origin,
    mode: isHabitMode(record.mode) ? record.mode : "simple",
    edited: record.edited === true,
  };
}
