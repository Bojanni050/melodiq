import { detectGenres } from "./aggregate";

/**
 * Picking the reference clips for an APIMart custom model ("DNA model").
 *
 * APIMart trains from 6–24 audio clips, not from a text profile, so Melody DNA
 * only helps by answering one question: which finished tracks sound most like
 * the rest of this catalogue? This module answers it with an explicit,
 * explainable score instead of an opaque similarity number — every candidate
 * carries the reasons behind its score, because the user has to be able to
 * disagree with the suggestion and swap a track out.
 *
 * Rules that keep the score honest:
 * - A component only counts when both sides know the value. A track without
 *   Track DNA is not punished for missing data; it simply contributes fewer
 *   components, and `score` stays null when nothing could be compared.
 * - Ratings are the user's own judgement, so they weigh, but they cannot
 *   dominate the sound: at most one fifth of the score.
 * - Nothing here writes or recomputes DNA. The profile is read as-is.
 */

/** APIMart's documented bounds for one custom-model training run. */
export { DNA_MODEL_MAX_TRACKS, DNA_MODEL_MIN_TRACKS, DNA_MODEL_SUGGESTED_TRACKS } from "./model-spec";

/** Half-range (in BPM) at which a tempo match scores 0. */
const TEMPO_SPAN = 24;
/** Half-range on the 0–100 energy scale at which an energy match scores 0. */
const ENERGY_SPAN = 35;

export type DnaFitTargets = {
  tempo: number | null;
  energy: number | null;
  genres: string[];
  atmospheres: string[];
};

export type DnaFitTrait = {
  traitKey: string;
  valueNumber: number | null;
  valueText: string | null;
};

export type DnaFitTrackInput = {
  id: string;
  title: string | null;
  createdAt: Date;
  rating: string | null;
  instrumental: boolean;
  prompt: string;
  /** tracks.audio_dna — the raw JSON column. */
  audioDna: string | null;
};

export type DnaFitCandidate = {
  id: string;
  title: string | null;
  createdAt: string;
  instrumental: boolean;
  /** 0–100, or null when neither side had anything to compare. */
  score: number | null;
  reasons: string[];
};

type ParsedTrackDna = {
  tempo: number | null;
  energy: number | null;
  atmosphereTags: string[];
};

function parseTrackDna(raw: string | null): ParsedTrackDna | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      tempo?: unknown;
      energy?: unknown;
      atmosphereTags?: unknown;
    };
    return {
      tempo: typeof parsed.tempo === "number" ? parsed.tempo : null,
      energy: typeof parsed.energy === "number" ? parsed.energy : null,
      atmosphereTags: Array.isArray(parsed.atmosphereTags)
        ? parsed.atmosphereTags.filter((tag): tag is string => typeof tag === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function parseTraitList(valueText: string | null): string[] {
  if (!valueText) return [];
  try {
    const parsed = JSON.parse(valueText);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
    }
  } catch {
    // Older rows may hold a plain comma-separated string instead of JSON.
  }
  return valueText
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** The DNA values the ranking compares against, read from one profile snapshot. */
export function dnaFitTargets(traits: DnaFitTrait[]): DnaFitTargets {
  const byKey = new Map(traits.map((trait) => [trait.traitKey, trait]));
  const numberFor = (key: string) => {
    const value = byKey.get(key)?.valueNumber;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  return {
    tempo: numberFor("tempo"),
    energy: numberFor("energy"),
    genres: parseTraitList(byKey.get("genres")?.valueText ?? null).slice(0, 3),
    atmospheres: parseTraitList(byKey.get("atmospheres")?.valueText ?? null).slice(0, 3),
  };
}

function closeness(value: number, target: number, span: number): number {
  return 1 - Math.min(Math.abs(value - target) / span, 1);
}

function overlap<T>(values: T[], targets: T[], normalize: (value: T) => string): number {
  if (values.length === 0 || targets.length === 0) return 0;
  const wanted = new Set(targets.map(normalize));
  const matched = values.filter((value) => wanted.has(normalize(value))).length;
  return matched / Math.min(values.length, targets.length);
}

/**
 * Scores one track against the DNA targets.
 *
 * Weights: tempo 3, energy 2, atmosphere 2, genre 2, rating 1. Tempo carries the
 * most because it is the one dimension Track DNA measures exactly for every
 * analysed track, so it is the only one that is rarely missing.
 */
export function scoreDnaFit(track: DnaFitTrackInput, targets: DnaFitTargets): {
  score: number | null;
  reasons: string[];
} {
  const dna = parseTrackDna(track.audioDna);
  const components: { weight: number; value: number }[] = [];
  const reasons: string[] = [];

  if (dna?.tempo != null && targets.tempo != null) {
    components.push({ weight: 3, value: closeness(dna.tempo, targets.tempo, TEMPO_SPAN) });
    reasons.push(`${Math.round(dna.tempo)} BPM`);
  }
  if (dna?.energy != null && targets.energy != null) {
    components.push({ weight: 2, value: closeness(dna.energy, targets.energy, ENERGY_SPAN) });
    reasons.push(`energy ${Math.round(dna.energy)}`);
  }
  if (dna && dna.atmosphereTags.length > 0 && targets.atmospheres.length > 0) {
    const matched = dna.atmosphereTags.filter((tag) =>
      targets.atmospheres.some((target) => target.toLowerCase() === tag.toLowerCase())
    );
    components.push({ weight: 2, value: overlap(dna.atmosphereTags, targets.atmospheres, (v) => v.toLowerCase()) });
    if (matched.length > 0) reasons.push(matched.slice(0, 2).join(" · "));
  }
  const trackGenres = detectGenres(track.prompt);
  if (trackGenres.length > 0 && targets.genres.length > 0) {
    const matched = trackGenres.filter((genre) =>
      targets.genres.some((target) => target.toLowerCase() === genre.toLowerCase())
    );
    components.push({ weight: 2, value: overlap(trackGenres, targets.genres, (v) => v.toLowerCase()) });
    if (matched.length > 0) reasons.push(matched.slice(0, 2).join(" · "));
  }
  if (track.rating === "up" || track.rating === "down") {
    components.push({ weight: 1, value: track.rating === "up" ? 1 : 0 });
    reasons.push(track.rating === "up" ? "rated up" : "rated down");
  }

  if (components.length === 0) return { score: null, reasons };

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const weighted = components.reduce((sum, component) => sum + component.weight * component.value, 0);
  return { score: Math.round((weighted / totalWeight) * 100), reasons };
}

/**
 * Ranks tracks for the model dialog: best DNA fit first, then newest. Tracks
 * that could not be compared (score null) stay at the bottom instead of being
 * dropped — a small catalogue still needs 6 clips.
 */
export function rankDnaModelCandidates(
  tracks: DnaFitTrackInput[],
  targets: DnaFitTargets
): DnaFitCandidate[] {
  return tracks
    .map((track) => {
      const { score, reasons } = scoreDnaFit(track, targets);
      return {
        id: track.id,
        title: track.title,
        createdAt: track.createdAt.toISOString(),
        instrumental: track.instrumental,
        score,
        reasons,
        sortKey: track.createdAt.getTime(),
      };
    })
    .sort((a, b) => {
      if (a.score === null && b.score === null) return b.sortKey - a.sortKey;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      if (a.score !== b.score) return b.score - a.score;
      return b.sortKey - a.sortKey;
    })
    .map(({ sortKey: _sortKey, ...candidate }) => candidate);
}
