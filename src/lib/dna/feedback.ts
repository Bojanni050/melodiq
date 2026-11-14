/**
 * User corrections for Melody DNA.
 *
 * Corrections are events, not edits: `dna_feedback_events` is append-only and
 * the stance for a trait is folded from its events in order. That keeps the
 * audit trail intact, lets "reset" be a normal event instead of a delete, and
 * means a recompute (which replaces the trait snapshot wholesale) can never
 * throw away what the user told us.
 */

export const DNA_FEEDBACK_KINDS = ["confirm", "reject", "more", "less", "reset"] as const;
export type DnaFeedbackKind = (typeof DNA_FEEDBACK_KINDS)[number];

export type DnaFeedbackVerdict = "confirm" | "reject";
export type DnaFeedbackDirection = "more" | "less";

export type DnaFeedbackEvent = {
  traitKey: string;
  category?: string | null;
  kind: DnaFeedbackKind;
  createdAt: Date | string;
};

/** What the user currently thinks about one trait. */
export type DnaFeedbackStance = {
  traitKey: string;
  verdict: DnaFeedbackVerdict | null;
  direction: DnaFeedbackDirection | null;
  /** Time of the event that produced the current stance. */
  updatedAt: string | null;
};

/**
 * How much of the remaining doubt a confirmation removes, and how hard a
 * rejection cuts. Confirming cannot invent evidence: it moves the trait toward
 * certainty by a fraction of the gap, so a one-track guess stays cautious.
 * Rejecting overrides whatever the data suggested, so it has to hurt.
 */
export const CONFIRM_BOOST = 0.35;
export const REJECT_FACTOR = 0.35;

/** Confidence floor below which the UI should still call a trait "learning". */
export const DISPUTED_CONFIDENCE = 0.45;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toMillis(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  // Unparseable timestamps keep their input order instead of crashing a fold.
  return Number.isFinite(time) ? time : 0;
}

export function isDnaFeedbackKind(value: unknown): value is DnaFeedbackKind {
  return typeof value === "string" && (DNA_FEEDBACK_KINDS as readonly string[]).includes(value);
}

/**
 * Folds the user's event log into one stance per trait.
 *
 * Events are applied in chronological order: a confirm/reject sets the verdict,
 * more/less sets the direction, and reset clears both. Stances that end up empty
 * are dropped, so "reset" leaves no trace in the UI but stays in the database.
 */
export function foldFeedback(events: DnaFeedbackEvent[]): Map<string, DnaFeedbackStance> {
  const ordered = events
    .map((event, index) => ({ event, index, time: toMillis(event.createdAt) }))
    .sort((a, b) => a.time - b.time || a.index - b.index);

  const stances = new Map<string, DnaFeedbackStance>();

  for (const { event, time } of ordered) {
    if (!event.traitKey) continue;

    const current: DnaFeedbackStance = stances.get(event.traitKey) ?? {
      traitKey: event.traitKey,
      verdict: null,
      direction: null,
      updatedAt: null,
    };

    switch (event.kind) {
      case "confirm":
      case "reject":
        current.verdict = event.kind;
        break;
      case "more":
      case "less":
        current.direction = event.kind;
        break;
      case "reset":
        current.verdict = null;
        current.direction = null;
        break;
    }

    if (time > 0) {
      current.updatedAt = new Date(time).toISOString();
    }

    if (current.verdict === null && current.direction === null) {
      stances.delete(event.traitKey);
    } else {
      stances.set(event.traitKey, current);
    }
  }

  return stances;
}

export type DnaFeedbackAdjustment = {
  confidence: number;
  /** Confirmed/disputed is the UI label for verdict; direction is separate. */
  verdict: "confirmed" | "disputed" | null;
  direction: DnaFeedbackDirection | null;
};

/**
 * Applies a stance to a computed confidence. Pure and repeatable: the stored
 * trait keeps its measured confidence, so removing the correction restores
 * exactly the original value.
 */
export function applyFeedback(
  confidence: number,
  stance: DnaFeedbackStance | undefined | null,
): DnaFeedbackAdjustment {
  const base = clamp01(confidence);
  if (!stance) return { confidence: base, verdict: null, direction: null };

  let adjusted = base;
  if (stance.verdict === "confirm") {
    adjusted = base + (1 - base) * CONFIRM_BOOST;
  } else if (stance.verdict === "reject") {
    adjusted = base * REJECT_FACTOR;
  }

  return {
    confidence: Math.round(clamp01(adjusted) * 100) / 100,
    verdict: stance.verdict === "confirm" ? "confirmed" : stance.verdict === "reject" ? "disputed" : null,
    direction: stance.direction,
  };
}
