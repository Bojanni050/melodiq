/**
 * Trait history and locks for Melody DNA.
 *
 * The snapshot in `dna_traits` answers "what is this trait now". This module
 * answers "how did it get there": which values really moved between two
 * recomputes, which traits the user pinned, and when a trait last changed.
 *
 * Pure on purpose — no database, no Drizzle, no React — so the rules are
 * testable against plain objects. The repository is responsible for loading the
 * previous snapshot and persisting what comes out of here.
 */

export type TraitSnapshot = {
  traitKey: string;
  category: string;
  kind: string;
  valueNumber: number | null;
  valueText: string | null;
  display: string | null;
  confidence: number;
  sourceCount: number;
  weight: number;
  firstSeenAt: Date;
  lastChangedAt: Date;
  lockedAt: Date | null;
};

export type TraitChange = {
  traitKey: string;
  category: string;
  previousDisplay: string | null;
  display: string | null;
  previousNumber: number | null;
  valueNumber: number | null;
  /**
   * "up" / "down" when both sides carry a number, "changed" otherwise — a
   * rewritten list of signature words has no up or down, and inventing one
   * would make the trend chart lie.
   */
  direction: "up" | "down" | "changed";
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Two values are the same when the number (rounded) and the text agree. */
function sameTraitValue(a: TraitSnapshot, b: TraitSnapshot): boolean {
  const numberA = a.valueNumber === null ? null : round1(a.valueNumber);
  const numberB = b.valueNumber === null ? null : round1(b.valueNumber);
  const textA = a.valueText ?? null;
  const textB = b.valueText ?? null;
  return numberA === numberB && textA === textB;
}

function byKey(traits: TraitSnapshot[]): Map<string, TraitSnapshot> {
  return new Map(traits.map((trait) => [trait.traitKey, trait]));
}

/**
 * One row per trait whose value really moved. Traits that appeared, disappeared
 * or only gained confidence produce nothing: the first is a new fact (not a
 * change), the second is the absence of one, and confidence already has its own
 * column and its own explanation in the UI.
 */
export function diffTraits(previous: TraitSnapshot[], next: TraitSnapshot[]): TraitChange[] {
  const before = byKey(previous);
  const changes: TraitChange[] = [];

  for (const trait of next) {
    const old = before.get(trait.traitKey);
    if (!old) continue;
    if (sameTraitValue(old, trait)) continue;

    // A rewritten label ("first" → "mixed", a new signature-word list) has no up
    // or down: the direction follows the meaning, not the share behind it.
    const labelMoved = (old.valueText ?? null) !== (trait.valueText ?? null);
    const direction: TraitChange["direction"] =
      !labelMoved && old.valueNumber !== null && trait.valueNumber !== null
        ? round1(trait.valueNumber) >= round1(old.valueNumber)
          ? "up"
          : "down"
        : "changed";

    changes.push({
      traitKey: trait.traitKey,
      category: trait.category,
      previousDisplay: old.display,
      display: trait.display,
      previousNumber: old.valueNumber,
      valueNumber: trait.valueNumber,
      direction,
    });
  }

  return changes;
}

/**
 * Pinned traits survive a recompute.
 *
 * A lock is the user saying "this is right, stop re-deriving it", so the fresh
 * value is dropped in favour of the stored one — including when the trait
 * disappears from the build entirely, because a trait someone pinned should not
 * vanish from their profile because a threshold moved.
 */
export function applyLocks(previous: TraitSnapshot[], next: TraitSnapshot[]): TraitSnapshot[] {
  const before = byKey(previous);
  const locked = previous.filter((trait) => trait.lockedAt !== null);
  if (locked.length === 0) return next;

  const lockedKeys = new Set(locked.map((trait) => trait.traitKey));
  const merged = next.map((trait) => (lockedKeys.has(trait.traitKey) ? before.get(trait.traitKey)! : trait));
  const present = new Set(merged.map((trait) => trait.traitKey));
  for (const trait of locked) {
    if (!present.has(trait.traitKey)) merged.push(trait);
  }
  return merged;
}

/**
 * Keeps `firstSeenAt` and `lastChangedAt` honest across recomputes: a rebuild
 * that reproduces the same value must not look like a change, or every trait
 * would pulse on every rebuild.
 */
export function stampTimeline(
  previous: TraitSnapshot[],
  traits: TraitSnapshot[],
  options: { now: Date },
): TraitSnapshot[] {
  const before = byKey(previous);
  return traits.map((trait) => {
    const old = before.get(trait.traitKey);
    if (!old) return { ...trait, firstSeenAt: options.now, lastChangedAt: options.now };
    return {
      ...trait,
      firstSeenAt: old.firstSeenAt,
      lastChangedAt: sameTraitValue(old, trait) ? old.lastChangedAt : options.now,
    };
  });
}
