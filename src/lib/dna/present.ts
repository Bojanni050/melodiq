import { applyFeedback, type DnaFeedbackDirection } from "./feedback";
import { PULSE_WINDOW_DAYS, traitState, traitTrend, type ProfileSignals, type TraitState } from "./states";
import { DNA_CATEGORIES, DNA_CATEGORY_LABELS } from "./types";
import type { StoredDnaProfile } from "./repository";

/**
 * API shape for Melody DNA. Kept separate from the Drizzle rows so the client
 * never depends on column names (trait_key vs key) and so a future phase can
 * reshape the payload without touching persistence.
 */
export type DnaTraitPayload = {
  key: string;
  category: string;
  label: string;
  kind: string;
  value: number | null;
  text: string | null;
  unit: string | null;
  display: string | null;
  /** Measured confidence with the user's correction already applied. */
  confidence: number;
  sourceCount: number;
  weight: number;
  /** confirmed | disputed | null — the user's verdict, not a measurement. */
  verdict: "confirmed" | "disputed" | null;
  /** more | less | null — a wish for the generator, independent of the verdict. */
  direction: DnaFeedbackDirection | null;
  /** When the correction that produced the current stance was recorded. */
  feedbackAt: string | null;
  /**
   * Derived state the UI renders: dark (no row at all), learning, sure,
   * pulsing (changed in the last seven days) or locked (pinned by the user).
   * Computed from the adjusted confidence, so what the user sees and what the
   * badge says cannot disagree.
   */
  state: TraitState;
  /** Direction of the last few real changes: up | down | steady. */
  trend: "up" | "down" | "steady";
  pulsing: boolean;
  /** Set when the user pinned this trait; a recompute then leaves it alone. */
  lockedAt: string | null;
  firstSeenAt: string | null;
  lastChangedAt: string | null;
};

/** Cap on the change log in one payload; the page shows the recent tail. */
const MAX_PAYLOAD_CHANGES = 60;

/** One recorded change, newest first in the payload. */
export type DnaChangePayload = {
  traitKey: string;
  category: string;
  from: string | null;
  to: string | null;
  direction: string;
  changedAt: string;
};

export type DnaProfilePayload = {
  /** '' = account-wide default tab, otherwise the artist alias. */
  artistAlias: string;
  name: string | null;
  summary: string | null;
  sourceCount: number;
  ratedCount: number;
  likedCount: number;
  dislikedCount: number;
  computedAt: string | null;
};

export type DnaPayload = {
  profile: DnaProfilePayload | null;
  traits: DnaTraitPayload[];
  categories: { id: string; label: string }[];
  /** "1200 songs · 0 edits · 2 calibrations" plus the raw counters. */
  signals: ProfileSignals;
  /** The recent tail of the change log, newest first. */
  changes: DnaChangePayload[];
};

/** Recent changes per trait, newest first, so a state and a trend can be read. */
function changesByTrait(changes: DnaChangePayload[]): Map<string, DnaChangePayload[]> {
  const grouped = new Map<string, DnaChangePayload[]>();
  for (const change of changes) {
    const bucket = grouped.get(change.traitKey);
    if (bucket) bucket.push(change);
    else grouped.set(change.traitKey, [change]);
  }
  return grouped;
}

export function serialiseDnaProfile(
  stored: StoredDnaProfile | null,
  options: { now?: Date } = {},
): DnaPayload {
  const categories = DNA_CATEGORIES.map((id) => ({ id, label: DNA_CATEGORY_LABELS[id] }));
  const emptySignals = { songs: 0, edits: 0, calibrations: 0, label: "0 songs · 0 edits · 0 calibrations" };

  if (!stored) {
    return { profile: null, traits: [], categories, signals: emptySignals, changes: [] };
  }

  const now = options.now ?? new Date();
  const changes: DnaChangePayload[] = (stored.history ?? []).slice(0, MAX_PAYLOAD_CHANGES).map((row) => ({
    traitKey: row.traitKey,
    category: row.category,
    from: row.previousDisplay,
    to: row.display,
    direction: row.direction,
    changedAt: row.changedAt.toISOString(),
  }));
  const grouped = changesByTrait(changes);

  return {
    signals: stored.signals ?? emptySignals,
    changes,
    profile: {
      artistAlias: stored.profile.artistAlias,
      name: stored.profile.name,
      summary: stored.profile.summary,
      sourceCount: stored.profile.sourceCount,
      ratedCount: stored.profile.ratedCount,
      likedCount: stored.profile.likedCount,
      dislikedCount: stored.profile.dislikedCount,
      computedAt: stored.profile.computedAt ? stored.profile.computedAt.toISOString() : null,
    },
    traits: stored.traits.map((trait) => {
      const stance = stored.feedback.get(trait.traitKey);
      const adjustment = applyFeedback(trait.confidence, stance);
      const changesForTrait = grouped.get(trait.traitKey) ?? [];
      // Pulsing needs a *recorded* change inside the window, not just a recent
      // timestamp: the migration that introduced history stamped every existing
      // row with "now", and without this a whole profile would pulse for a week
      // over changes that were never observed.
      const pulsed = changesForTrait.some((change) => {
        const age = now.getTime() - new Date(change.changedAt).getTime();
        return age >= 0 && age < PULSE_WINDOW_DAYS * 86_400_000;
      });
      const state = traitState(
        {
          confidence: adjustment.confidence,
          lockedAt: trait.lockedAt ?? null,
          lastChangedAt: pulsed ? trait.lastChangedAt ?? null : null,
        },
        { now },
      );

      return {
        key: trait.traitKey,
        category: trait.category,
        label: trait.label,
        kind: trait.kind,
        value: trait.valueNumber,
        text: trait.valueText,
        unit: trait.unit,
        display: trait.display,
        confidence: adjustment.confidence,
        sourceCount: trait.sourceCount,
        weight: trait.weight,
        verdict: adjustment.verdict,
        direction: adjustment.direction,
        feedbackAt: stance?.updatedAt ?? null,
        state,
        trend: traitTrend(changesForTrait),
        pulsing: state === "pulsing",
        lockedAt: trait.lockedAt ? trait.lockedAt.toISOString() : null,
        firstSeenAt: trait.firstSeenAt ? trait.firstSeenAt.toISOString() : null,
        lastChangedAt: trait.lastChangedAt ? trait.lastChangedAt.toISOString() : null,
      };
    }),
    categories,
  };
}
