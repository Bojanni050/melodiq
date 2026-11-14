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
  confidence: number;
  sourceCount: number;
  weight: number;
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

export function serialiseDnaProfile(stored: StoredDnaProfile | null): {
  profile: DnaProfilePayload | null;
  traits: DnaTraitPayload[];
  categories: { id: string; label: string }[];
} {
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
    traits: stored.traits.map((trait) => ({
      key: trait.traitKey,
      category: trait.category,
      label: trait.label,
      kind: trait.kind,
      value: trait.valueNumber,
      text: trait.valueText,
      unit: trait.unit,
      display: trait.display,
      confidence: trait.confidence,
      sourceCount: trait.sourceCount,
      weight: trait.weight,
    })),
    categories,
  };
}
