import type { AudioDna } from "@/lib/songs";

/**
 * Melody DNA sits on top of the per-track Track DNA. These are the shared
 * shapes between the pure aggregator (lib/dna/aggregate.ts), the persistence
 * layer (lib/dna/repository.ts) and the API routes, so they stay free of any
 * Drizzle or React imports.
 */
export const DNA_CATEGORIES = ["sound", "voice", "structure", "words", "taste"] as const;

export type DnaCategory = (typeof DNA_CATEGORIES)[number];

export const DNA_CATEGORY_LABELS: Record<DnaCategory, string> = {
  sound: "Sound",
  voice: "Voice",
  structure: "Structure",
  words: "Words",
  taste: "Taste",
};

/** How the UI should read a trait: a scalar, a phrase, a tag list or a share. */
export type DnaTraitKind = "number" | "text" | "list" | "ratio";

export type DnaTrait = {
  key: string;
  category: DnaCategory;
  label: string;
  kind: DnaTraitKind;
  valueNumber: number | null;
  /** JSON array for kind="list", plain string for kind="text". */
  valueText: string | null;
  unit: string | null;
  display: string;
  /** 0..1 — evidence amount times agreement between tracks. */
  confidence: number;
  sourceCount: number;
  weight: number;
};

/** The subset of AdvancedDnaResult that matters when aggregating. */
export type AdvancedDnaSummary = {
  compositionScore: number | null;
  vocalScore: number | null;
  productionScore: number | null;
  overallScore: number | null;
};

/**
 * One finished track as the aggregator sees it. Deliberately decoupled from
 * the full track row so tests can build sources without a database.
 */
export type DnaSourceTrack = {
  id: string;
  createdAt: Date | null;
  /** Seconds. */
  duration: number | null;
  prompt: string | null;
  lyrics: string | null;
  language: string | null;
  instrumental: boolean;
  vocalGender: string | null;
  /** "up" | "down" | null */
  rating: string | null;
  playCount: number;
  archivedAt: Date | null;
  hiddenAt: Date | null;
  audioDna: AudioDna | null;
  advancedDna: AdvancedDnaSummary | null;
};

export type DnaProfileSummary = {
  name: string;
  summary: string;
  sourceCount: number;
  ratedCount: number;
  likedCount: number;
  dislikedCount: number;
};

export type DnaBuildResult = {
  profile: DnaProfileSummary;
  traits: DnaTrait[];
};
