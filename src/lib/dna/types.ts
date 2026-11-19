import type { AudioDna } from "@/lib/songs";

import type { HabitMode, HabitOrigin } from "./habits";

/**
 * Melody DNA sits on top of the per-track Track DNA. These are the shared
 * shapes between the pure aggregator (lib/dna/aggregate.ts), the persistence
 * layer (lib/dna/repository.ts) and the API routes, so they stay free of any
 * Drizzle or React imports.
 */
export const DNA_CATEGORIES = ["sound", "voice", "structure", "words", "taste", "habits"] as const;

export type DnaCategory = (typeof DNA_CATEGORIES)[number];

export const DNA_CATEGORY_LABELS: Record<DnaCategory, string> = {
  sound: "Sound",
  voice: "Voice",
  structure: "Structure",
  words: "Words",
  taste: "Taste",
  habits: "Habits",
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
 * One completed clone in the user's voice library, as Melody DNA sees it.
 * `id` is what tracks record in `voice_id`, so usage can be counted per voice.
 */
export type DnaVoice = {
  id: string;
  /** User-given label; null when the clone was never named. */
  name: string | null;
  isSelected: boolean;
};

/**
 * The user's voice-clone library as Melody DNA sees it. Used as the fallback
 * for "Own voice" when no track records whether a persona sang it (tracks from
 * before the `own_voice` migration, or only instrumentals), and as the pool for
 * "Favorite voices".
 */
export type DnaVoiceProfile = {
  /** Completed clones in the library. */
  voiceCount: number;
  /** The one the Studio sends as persona_id, if any. */
  selectedName: string | null;
  /** Full library, newest first. Absent on older callers/tests. */
  voices?: DnaVoice[];
};

/**
 * Things the user deliberately kept, independent of track history: saved
 * lyrics (writing) and saved style presets (music). Titles only — the DNA card
 * shows what survived, not the full text.
 */
export type DnaLibraryProfile = {
  writingTitles: string[];
  musicNames: string[];
};

/** One generation request, reduced to what the habits traits ask about. */
export type DnaHabitEvent = {
  origin: HabitOrigin;
  mode: HabitMode;
  edited: boolean;
};

/**
 * Generation history plus the public/private split of the catalogue. The
 * events cover how songs start; the counts cover whether they end up public,
 * which is a property of the tracks rather than of a single action.
 */
export type DnaHabitProfile = {
  /** Newest first; bounded by the repository. */
  events: DnaHabitEvent[];
  publicTracks: number;
  totalTracks: number;
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
  /** Generation provider id (see PROVIDER_LABELS); "upload" for imported audio. */
  provider: string;
  lyrics: string | null;
  language: string | null;
  instrumental: boolean;
  /** Whether this generation used the user's cloned voice. Null = unknown. */
  ownVoice: boolean | null;
  /** Which clone sang it (cloned_voices.id). Null = unknown/not applicable. */
  voiceId: string | null;
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
