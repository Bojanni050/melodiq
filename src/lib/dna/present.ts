import { applyFeedback, type DnaFeedbackDirection } from "./feedback";
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
};

export type DnaProfilePayload = {
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
};

export function serialiseDnaProfile(stored: StoredDnaProfile | null): DnaPayload {
  const categories = DNA_CATEGORIES.map((id) => ({ id, label: DNA_CATEGORY_LABELS[id] }));

  if (!stored) {
    return { profile: null, traits: [], categories };
  }

  return {
    profile: {
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
      };
    }),
    categories,
  };
}
