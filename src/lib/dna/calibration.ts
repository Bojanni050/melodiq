/**
 * Calibration duels for Melody DNA.
 *
 * Two of the user's own tracks are set against each other on one trait ("which
 * tempo is more you?"). The pick becomes an ordinary feedback event on that
 * trait (see feedback.ts), so calibration needs no scoring model of its own:
 * choosing the faster track says "more tempo", the slower one "less", and
 * "Neither" rejects the trait.
 *
 * Pure maths only, no database and no React, so pair selection stays testable
 * and deterministic for a given catalogue and answer history.
 */

import type { DnaFeedbackKind } from "./feedback";

/** A calibration run is this many duels. */
export const CALIBRATION_TOTAL = 40;

/** Cap on tracks considered per pick; pairs grow quadratically. */
export const CALIBRATION_MAX_CANDIDATES = 120;

export type CalibrationTrait = {
  key: string;
  /** Smallest difference that is still audible as "different". */
  minGap: number;
  unit: string | null;
};

/** Traits that have a per-track number to duel on. Order is the rotation. */
export const CALIBRATION_TRAITS: readonly CalibrationTrait[] = [
  { key: "tempo", minGap: 20, unit: "BPM" },
  { key: "energy", minGap: 25, unit: null },
];

export type CalibrationCandidate = {
  id: string;
  title: string | null;
  prompt: string | null;
  audioUrl: string;
  /** Seconds. */
  duration: number | null;
  tempo: number | null;
  energy: number | null;
};

export type CalibrationAnswered = {
  traitKey: string;
  trackAId: string;
  trackBId: string;
};

export type CalibrationPair = {
  traitKey: string;
  left: CalibrationCandidate;
  right: CalibrationCandidate;
  leftValue: number;
  rightValue: number;
};

export type CalibrationChoice = "left" | "right" | "neither";

function readValue(candidate: CalibrationCandidate, traitKey: string): number | null {
  const raw = traitKey === "tempo" ? candidate.tempo : traitKey === "energy" ? candidate.energy : null;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** Order-independent id for a pair on one trait. */
export function calibrationPairKey(traitKey: string, firstId: string, secondId: string): string {
  return firstId < secondId ? `${traitKey}:${firstId}:${secondId}` : `${traitKey}:${secondId}:${firstId}`;
}

/** Stores a pair in sorted order, matching the unique-ish shape in the table. */
export function sortPairIds(firstId: string, secondId: string): [string, string] {
  return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
}

/**
 * Picks the next duel, or null when nothing is left to ask.
 *
 * Traits rotate with the answer count so a run alternates between them. Within
 * a trait the least-used tracks go first (a run should sample the catalogue,
 * not replay the two most extreme songs), then the widest gap, then id order
 * for stability. Which track lands on the left flips every other answer so the
 * faster song is not always the same side.
 */
export function pickCalibrationPair(options: {
  candidates: CalibrationCandidate[];
  /** Trait keys present in the user's profile; duels on others would be dead ends. */
  availableTraitKeys: ReadonlySet<string>;
  answered: CalibrationAnswered[];
}): CalibrationPair | null {
  const { availableTraitKeys, answered } = options;
  const candidates = options.candidates.slice(0, CALIBRATION_MAX_CANDIDATES);
  const traits = CALIBRATION_TRAITS.filter((trait) => availableTraitKeys.has(trait.key));
  if (traits.length === 0 || candidates.length < 2) return null;

  const seen = new Set(answered.map((entry) => calibrationPairKey(entry.traitKey, entry.trackAId, entry.trackBId)));
  const usage = new Map<string, number>();
  for (const entry of answered) {
    usage.set(entry.trackAId, (usage.get(entry.trackAId) ?? 0) + 1);
    usage.set(entry.trackBId, (usage.get(entry.trackBId) ?? 0) + 1);
  }

  const start = answered.length % traits.length;
  for (let offset = 0; offset < traits.length; offset += 1) {
    const trait = traits[(start + offset) % traits.length];
    const valued = candidates
      .map((candidate) => ({ candidate, value: readValue(candidate, trait.key) }))
      .filter((entry): entry is { candidate: CalibrationCandidate; value: number } => entry.value !== null);

    let best: {
      a: (typeof valued)[number];
      b: (typeof valued)[number];
      used: number;
      gap: number;
    } | null = null;

    for (let i = 0; i < valued.length; i += 1) {
      for (let j = i + 1; j < valued.length; j += 1) {
        const a = valued[i];
        const b = valued[j];
        const gap = Math.abs(a.value - b.value);
        if (gap < trait.minGap) continue;
        if (seen.has(calibrationPairKey(trait.key, a.candidate.id, b.candidate.id))) continue;

        const used = (usage.get(a.candidate.id) ?? 0) + (usage.get(b.candidate.id) ?? 0);
        const better =
          best === null ||
          used < best.used ||
          (used === best.used && gap > best.gap) ||
          (used === best.used &&
            gap === best.gap &&
            calibrationPairKey(trait.key, a.candidate.id, b.candidate.id) <
              calibrationPairKey(trait.key, best.a.candidate.id, best.b.candidate.id));
        if (better) best = { a, b, used, gap };
      }
    }

    if (best) {
      // Slower track first on even answers, faster first on odd ones.
      const [lowFirst, highFirst] = best.a.value <= best.b.value ? [best.a, best.b] : [best.b, best.a];
      const [first, second] = answered.length % 2 === 0 ? [lowFirst, highFirst] : [highFirst, lowFirst];
      return {
        traitKey: trait.key,
        left: first.candidate,
        right: second.candidate,
        leftValue: first.value,
        rightValue: second.value,
      };
    }
  }

  return null;
}

/**
 * Turns a pick into the feedback kind that goes into the event log.
 * Choosing the higher value is "more of this", the lower value "less of this".
 */
export function feedbackKindForChoice(pair: CalibrationPair, choice: CalibrationChoice): DnaFeedbackKind {
  if (choice === "neither") return "reject";
  const chosen = choice === "left" ? pair.leftValue : pair.rightValue;
  const other = choice === "left" ? pair.rightValue : pair.leftValue;
  return chosen >= other ? "more" : "less";
}

/** First line of a prompt or title for a card, cut cleanly with an ellipsis. */
export function calibrationCardText(candidate: Pick<CalibrationCandidate, "title" | "prompt">, max = 90): string {
  const source = (candidate.title?.trim() || candidate.prompt?.trim() || "").split(/\r?\n/)[0] ?? "";
  if (source.length <= max) return source;
  return `${source.slice(0, max - 1).trimEnd()}…`;
}
