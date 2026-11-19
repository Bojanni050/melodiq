import { PROVIDER_LABELS } from "@/lib/format-generator";
import { parsePromptBpm, tempoOctaveRelation } from "@/lib/prompt-bpm";

import { classifyEnergyArc } from "./arc";
import { detectInstruments, instrumentDisplay } from "./instruments";
import { SPECTRA, spectrumScores, type SpectrumDefinition, type SpectrumKey } from "./spectra";

import type {
  AdvancedDnaSummary,
  DnaBuildResult,
  DnaCategory,
  DnaLibraryProfile,
  DnaProfileSummary,
  DnaSourceTrack,
  DnaTrait,
  DnaVoiceProfile,
} from "./types";

/**
 * Deterministic Melody DNA aggregation.
 *
 * Design rules:
 * - Only finished, non-deleted tracks are sources (filtered in the repository).
 * - Every source carries a weight: explicit ratings dominate, plays add a
 *   little, archived/hidden tracks count less, and older tracks fade with a
 *   one-year half-life (floored so a long catalogue never fully loses a taste).
 * - Confidence always reflects evidence: `coverage(n) * agreement`. A trait
 *   built from two tracks can never look as certain as one built from forty,
 *   and disagreement between tracks lowers it further.
 * - Missing signals produce no trait at all instead of a zero value, so the UI
 *   can show "still learning" rather than inventing numbers.
 */

const DAY_MS = 86_400_000;
const HALF_LIFE_DAYS = 365;
const MIN_RECENCY = 0.2;
/** Tracks needed before coverage reaches half of its maximum (n/(n+3)). */
const COVERAGE_HALF_POINT = 3;

const RATING_UP_MULTIPLIER = 3;
const RATING_DOWN_MULTIPLIER = 0.25;
const ARCHIVED_MULTIPLIER = 0.5;

/** Genres and moods we can recognise deterministically in a prompt. */
const GENRE_TERMS = [
  "drum and bass",
  "singer-songwriter",
  "lo-fi",
  "synthpop",
  "synthwave",
  "darksynth",
  "darkwave",
  "dream pop",
  "city pop",
  "vaporwave",
  "shoegaze",
  "post-punk",
  "post rock",
  "new wave",
  "hip hop",
  "trip hop",
  "r&b",
  "neo soul",
  "indie pop",
  "indie rock",
  "indie folk",
  "alt pop",
  "pop punk",
  "hard rock",
  "soft rock",
  "classic rock",
  "progressive rock",
  "psychedelic rock",
  "metalcore",
  "death metal",
  "black metal",
  "pop",
  "rock",
  "indie",
  "alternative",
  "electronic",
  "electronica",
  "edm",
  "house",
  "deep house",
  "tech house",
  "techno",
  "trance",
  "dubstep",
  "breakbeat",
  "garage",
  "grime",
  "trap",
  "drill",
  "rap",
  "soul",
  "funk",
  "disco",
  "jazz",
  "blues",
  "country",
  "folk",
  "americana",
  "bluegrass",
  "metal",
  "punk",
  "hardcore",
  "emo",
  "ambient",
  "cinematic",
  "orchestral",
  "classical",
  "chillout",
  "downtempo",
  "reggae",
  "dancehall",
  "latin",
  "afrobeat",
  "salsa",
  "bossa nova",
  "gospel",
  "acoustic",
  "ballad",
  "industrial",
  "k-pop",
  "j-pop",
];

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  eng: "English",
  english: "English",
  nl: "Dutch",
  dutch: "Dutch",
  de: "German",
  german: "German",
  fr: "French",
  french: "French",
  es: "Spanish",
  spanish: "Spanish",
  it: "Italian",
  italian: "Italian",
  pt: "Portuguese",
  portuguese: "Portuguese",
  sv: "Swedish",
  swedish: "Swedish",
  no: "Norwegian",
  da: "Danish",
  fi: "Finnish",
  pl: "Polish",
  tr: "Turkish",
  ja: "Japanese",
  japanese: "Japanese",
  ko: "Korean",
  korean: "Korean",
  zh: "Chinese",
};

type Weighted = { value: number; weight: number };

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function capitalise(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

function normaliseText(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim()} `;
}

/**
 * Relative weight of one track in the profile: explicit feedback first, then
 * plays, then recency. Kept exported because the tests pin this down and later
 * phases (feedback calibration) will build on it.
 */
export function sourceWeight(track: DnaSourceTrack, now: Date): number {
  let weight = 1;

  if (track.rating === "up") weight *= RATING_UP_MULTIPLIER;
  else if (track.rating === "down") weight *= RATING_DOWN_MULTIPLIER;

  if (track.playCount > 0) {
    // Logarithmic: the difference between 0 and 5 plays matters far more than
    // between 50 and 55.
    weight *= 1 + Math.min(1, Math.log10(1 + track.playCount) / 2);
  }

  if (track.archivedAt || track.hiddenAt) weight *= ARCHIVED_MULTIPLIER;

  if (track.createdAt) {
    const ageDays = Math.max(0, (now.getTime() - track.createdAt.getTime()) / DAY_MS);
    const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    weight *= Math.max(MIN_RECENCY, decay);
  }

  return weight;
}

/** n/(n+k): rises quickly with the first few tracks, then flattens out. */
function coverage(count: number): number {
  if (count <= 0) return 0;
  return count / (count + COVERAGE_HALF_POINT);
}

/**
 * Weighted mean plus the weighted spread. Spread is what separates "all my
 * tracks sit around 90 BPM" from "my tracks are everywhere", so it feeds
 * confidence rather than being thrown away.
 */
function weightedStats(samples: Weighted[]): { mean: number; spread: number; weight: number } | null {
  const usable = samples.filter((s) => Number.isFinite(s.value) && s.weight > 0);
  if (usable.length === 0) return null;

  const totalWeight = usable.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) return null;

  const mean = usable.reduce((sum, s) => sum + s.value * s.weight, 0) / totalWeight;
  const variance = usable.reduce((sum, s) => sum + s.weight * (s.value - mean) ** 2, 0) / totalWeight;

  return { mean, spread: Math.sqrt(variance), weight: totalWeight };
}

/** Longest + strongest label list, e.g. genres or atmospheres. */
function weightedCounts(entries: { value: string; weight: number }[]): { value: string; weight: number; count: number }[] {
  const buckets = new Map<string, { value: string; weight: number; count: number }>();
  for (const entry of entries) {
    const key = entry.value.trim().toLowerCase();
    if (!key || entry.weight <= 0) continue;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.weight += entry.weight;
      bucket.count += 1;
    } else {
      buckets.set(key, { value: key, weight: entry.weight, count: 1 });
    }
  }
  return [...buckets.values()].sort(
    (a, b) => b.weight - a.weight || b.count - a.count || a.value.localeCompare(b.value),
  );
}

function listTrait(options: {
  key: string;
  category: DnaCategory;
  label: string;
  values: { value: string; weight: number }[];
  limit: number;
  /**
   * Tracks that carried at least one value — not the number of values. Counting
   * tags made "2314 tracks" appear under a 500-track sample, because one track
   * can carry several genres.
   */
  sourceCount: number;
  /** Display form of a tag; grouping still uses the lowercased value. */
  displayValue?: (value: string) => string;
}): DnaTrait | null {
  const ranked = weightedCounts(options.values);
  if (ranked.length === 0) return null;

  const top = ranked.slice(0, options.limit);
  const labels = top.map((item) => (options.displayValue ? options.displayValue(item.value) : item.value));
  const totalWeight = ranked.reduce((sum, item) => sum + item.weight, 0);
  const sourceCount = options.sourceCount;
  // A single dominant tag is more meaningful than a scattering of one-offs, so
  // the top tag's share of the weight drives agreement.
  const agreement = totalWeight > 0 ? top[0].weight / totalWeight : 0;

  return {
    key: options.key,
    category: options.category,
    label: options.label,
    kind: "list",
    valueNumber: round1(agreement * 100),
    valueText: JSON.stringify(labels),
    unit: null,
    display: labels.join(", "),
    confidence: round1(clamp01(coverage(sourceCount) * Math.max(0.35, agreement)) * 100) / 100,
    sourceCount,
    weight: round1(totalWeight),
  };
}

function numericTrait(options: {
  key: string;
  category: DnaCategory;
  label: string;
  values: Weighted[];
  unit: string | null;
  /** Spread at which agreement hits zero. */
  spreadScale: number;
  format?: (value: number) => string;
}): DnaTrait | null {
  const stats = weightedStats(options.values);
  if (!stats) return null;

  const sourceCount = options.values.filter((s) => s.weight > 0).length;
  const agreement = clamp01(1 - stats.spread / options.spreadScale);
  const display = options.format
    ? options.format(stats.mean)
    : options.unit
      ? `${round1(stats.mean)} ${options.unit}`
      : `${round1(stats.mean)}`;

  return {
    key: options.key,
    category: options.category,
    label: options.label,
    kind: "number",
    valueNumber: round1(stats.mean),
    valueText: null,
    unit: options.unit,
    display,
    // Floored so a coherent-but-small catalogue still reads as "learning"
    // rather than "unknown"; the multiplier encodes agreement.
    confidence: round1(clamp01(coverage(sourceCount) * Math.max(0.3, agreement)) * 100) / 100,
    sourceCount,
    weight: round1(stats.weight),
  };
}

function textTrait(options: {
  key: string;
  category: DnaCategory;
  label: string;
  values: { value: string; weight: number }[];
}): DnaTrait | null {
  const ranked = weightedCounts(options.values);
  if (ranked.length === 0) return null;

  const totalWeight = ranked.reduce((sum, item) => sum + item.weight, 0);
  const sourceCount = ranked.reduce((sum, item) => sum + item.count, 0);
  const top = ranked[0];
  const share = totalWeight > 0 ? top.weight / totalWeight : 0;
  const label = LANGUAGE_NAMES[top.value] ?? capitalise(top.value);

  return {
    key: options.key,
    category: options.category,
    label: options.label,
    kind: "text",
    valueNumber: round1(share * 100),
    valueText: label,
    unit: null,
    display: `${label} ${Math.round(share * 100)}%`,
    confidence: round1(clamp01(coverage(sourceCount) * Math.max(0.35, share)) * 100) / 100,
    sourceCount,
    weight: round1(totalWeight),
  };
}

function ratioTrait(options: {
  key: string;
  category: DnaCategory;
  label: string;
  /** Numerator / denominator over weighted counts. */
  values: Weighted[];
  display: (ratio: number) => string;
}): DnaTrait | null {
  const stats = weightedStats(options.values);
  if (!stats) return null;

  const sourceCount = options.values.filter((s) => s.weight > 0).length;
  const ratio = clamp01(stats.mean);

  return {
    key: options.key,
    category: options.category,
    label: options.label,
    kind: "ratio",
    valueNumber: round1(ratio * 100),
    valueText: null,
    unit: "%",
    display: options.display(ratio),
    confidence: round1(coverage(sourceCount) * 100) / 100,
    sourceCount,
    weight: round1(stats.weight),
  };
}

/**
 * Fallback for "Own voice" when no track carries the per-track `own_voice`
 * flag (pre-migration catalogue, or only instrumentals). Since the migration
 * the ratio above is the real measurement; this keeps the card informative for
 * users whose tracks predate it instead of leaving the section empty.
 */
function ownVoiceTrait(voice: DnaVoiceProfile | null): DnaTrait | null {
  if (!voice || voice.voiceCount === 0) return null;

  const extra = voice.voiceCount > 1 ? `${voice.voiceCount} cloned voices` : "Cloned voice";
  return {
    key: "own_voice",
    category: "voice",
    label: "Own voice",
    kind: "text",
    valueNumber: 100,
    valueText: "cloned",
    unit: null,
    // The card's label already says what this is, so the value stays short and
    // language-neutral: the voice's name, or how many are in the library.
    display: voice.selectedName ?? extra,
    // A finished clone is a fact about the account, not a guess from tracks.
    // Selecting one in the Studio is what makes it the default sound.
    confidence: voice.selectedName ? 0.9 : 0.7,
    sourceCount: voice.voiceCount,
    weight: voice.voiceCount,
  };
}

/**
 * "Favorite voices": the clones this catalogue actually used, ranked by use.
 * Before any generation has sent a persona, the library itself is the only
 * honest answer, so it falls back to listing the saved voices instead of
 * inventing a favourite.
 */
function favoriteVoicesTrait(
  usage: { value: string; weight: number }[],
  tracksWithVoice: number,
  voice: DnaVoiceProfile | null,
): DnaTrait | null {
  const library = voice?.voices ?? [];
  const names = new Map(library.map((entry) => [entry.id, entry.name?.trim() || "Cloned voice"]));

  if (usage.length > 0) {
    return listTrait({
      key: "favorite_voices",
      category: "voice",
      label: "Favorite voices",
      values: usage,
      limit: 3,
      sourceCount: tracksWithVoice,
      displayValue: (id) => names.get(id) ?? "Cloned voice",
    });
  }

  // Selected voice first, then the rest as the user saved them.
  const labels = [...library]
    .sort((a, b) => Number(b.isSelected) - Number(a.isSelected))
    .map((entry) => entry.name?.trim())
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
  if (labels.length === 0) return null;

  return {
    key: "favorite_voices",
    category: "voice",
    label: "Favorite voices",
    kind: "list",
    valueNumber: 100,
    valueText: JSON.stringify(labels),
    unit: null,
    display: labels.join(", "),
    // A saved voice is a fact about the account, not a guess from the catalogue.
    confidence: voice?.selectedName ? 0.85 : 0.7,
    sourceCount: library.length,
    weight: library.length,
  };
}

/**
 * A trait built from a library the user curates (saved lyrics, style presets).
 * Unlike track-derived traits, confidence reflects that keeping something is a
 * deliberate act, not how many finished songs happen to exist.
 */
function libraryTrait(options: {
  key: string;
  category: DnaCategory;
  label: string;
  names: string[];
  limit?: number;
}): DnaTrait | null {
  const top = options.names.slice(0, options.limit ?? 3);
  if (top.length === 0) return null;

  return {
    key: options.key,
    category: options.category,
    label: options.label,
    kind: "list",
    valueNumber: 100,
    valueText: JSON.stringify(top),
    unit: null,
    display: top.join(", "),
    confidence: options.names.length > 1 ? 0.9 : 0.75,
    sourceCount: options.names.length,
    weight: options.names.length,
  };
}

/** Tracks that must name a spectrum's poles before it is reported at all. */
const MIN_SPECTRUM_SOURCES = 3;/**
 * One spectrum as a 0..100 trait. Below the minimum the trait is absent rather
 * than based on a single prompt; above it the mean is the position and the
 * spread still decides confidence, so a catalogue that splits between both
 * poles reads as uncertain instead of as a stable middle.
 */
function spectrumTrait(definition: SpectrumDefinition, values: Weighted[]): DnaTrait | null {
  const sources = values.filter((value) => value.weight > 0).length;
  if (sources < MIN_SPECTRUM_SOURCES) return null;

  return numericTrait({
    key: definition.key,
    category: "sound",
    label: `${definition.left} ↔ ${definition.right}`,
    values,
    unit: "%",
    spreadScale: 60,
    format: (value) => `${Math.round(value)}% ${value >= 50 ? definition.right : definition.left}`,
  });
}

/** Longest tags first, so "indie pop" wins and then hides the generic "pop". */
const GENRE_TERMS_BY_LENGTH = [...GENRE_TERMS].sort((a, b) => b.length - a.length);

/** Restores a provider's display casing after weightedCounts lowercases it. */
const ENGINE_DISPLAY = new Map(
  Object.values(PROVIDER_LABELS).map((label) => [label.toLowerCase(), label]),
);

function engineDisplay(value: string): string {
  return ENGINE_DISPLAY.get(value) ?? capitalise(value);
}

export function detectGenres(prompt: string | null): string[] {
  if (!prompt) return [];
  let haystack = normaliseText(prompt);
  const found: string[] = [];

  for (const term of GENRE_TERMS_BY_LENGTH) {
    const needle = normaliseText(term);
    if (!haystack.includes(needle)) continue;
    found.push(term);
    // Consume the span: without this, "indie pop" would also report "pop" and
    // the genre list would show the same influence twice.
    haystack = haystack.split(needle).join(" ".repeat(needle.length));
  }

  return found;
}

function countWords(lyrics: string | null): number | null {
  if (!lyrics) return null;
  const words = lyrics.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 ? words.length : null;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function tempoBand(bpm: number | null): string {
  if (bpm === null) return "Midtempo";
  if (bpm < 70) return "Downtempo";
  if (bpm < 95) return "Midtempo";
  if (bpm < 120) return "Uptempo";
  return "High-tempo";
}

function buildSummary(context: {
  sourceCount: number;
  ratedCount: number;
  likedCount: number;
  tempo: number | null;
  energy: number | null;
  vocalGender: string | null;
  language: string | null;
  atmospheres: string[];
  genres: string[];
}): string {
  const parts: string[] = [];
  const { sourceCount, ratedCount, likedCount } = context;

  parts.push(
    ratedCount > 0
      ? `Built from ${sourceCount} finished ${sourceCount === 1 ? "track" : "tracks"}, ${ratedCount} rated and ${likedCount} loved.`
      : `Built from ${sourceCount} finished ${sourceCount === 1 ? "track" : "tracks"} — no ratings yet.`,
  );

  const sound: string[] = [];
  if (context.tempo !== null) sound.push(`around ${Math.round(context.tempo)} BPM`);
  if (context.energy !== null) sound.push(`${Math.round(context.energy)}/100 energy`);
  if (context.vocalGender) sound.push(`${context.vocalGender} vocals`);
  if (context.language) sound.push(`${context.language.toLowerCase()} lyrics`);
  if (sound.length > 0) parts.push(`Typically ${sound.join(", ")}.`);

  if (context.genres.length > 0) {
    parts.push(`Mostly ${context.genres.slice(0, 3).join(", ")}.`);
  }
  if (context.atmospheres.length > 0) {
    parts.push(`Returns to ${context.atmospheres.slice(0, 3).join(", ")}.`);
  }
  if (ratedCount === 0) {
    parts.push("Rating a few tracks will sharpen this profile.");
  }

  return parts.join(" ");
}

function buildName(context: {
  tempo: number | null;
  genres: string[];
  atmospheres: string[];
  instrumentalOnly: boolean;
}): string {
  const band = tempoBand(context.tempo);
  const genre = context.genres[0] ?? null;
  const atmosphere = context.atmospheres[0] ?? null;

  if (genre) {
    return atmosphere ? `${band} ${atmosphere} ${genre}` : `${band} ${genre}`;
  }
  if (atmosphere) return `${band} ${atmosphere}`;
  return context.instrumentalOnly ? `${band} instrumentals` : `${band} songs`;
}

/**
 * Builds the whole profile in one pass. Pure: same sources + same `now` always
 * yields the same traits, which is what makes the API recompute idempotent.
 */
export function buildDnaProfile(
  sources: DnaSourceTrack[],
  options: { now?: Date; voice?: DnaVoiceProfile | null; library?: DnaLibraryProfile | null } = {},
): DnaBuildResult {
  const now = options.now ?? new Date();
  const usable = sources.filter((track) => track && track.id);

  if (usable.length === 0) {
    const emptyProfile: DnaProfileSummary = {
      name: "Not enough tracks yet",
      summary:
        "Melody DNA needs a few finished tracks with Track DNA analysis before it can describe your sound. Generate and finish a song to get started.",
      sourceCount: 0,
      ratedCount: 0,
      likedCount: 0,
      dislikedCount: 0,
    };
    return { profile: emptyProfile, traits: [] };
  }

  const weighted = usable.map((track) => ({ track, weight: sourceWeight(track, now) }));
  const rated = usable.filter((track) => track.rating === "up" || track.rating === "down");
  const liked = usable.filter((track) => track.rating === "up");
  const disliked = usable.filter((track) => track.rating === "down");

  const withVocals = usable.filter((track) => !track.instrumental);

  const tempoValues: Weighted[] = [];
  const intendedTempoValues: Weighted[] = [];
  const halfTimeValues: Weighted[] = [];
  const energyValues: Weighted[] = [];
  const energyArcValues: { value: string; weight: number }[] = [];
  const hookValues: Weighted[] = [];
  const instrumentValues: { value: string; weight: number }[] = [];
  const spectrumValues: Record<SpectrumKey, Weighted[]> = {
    rap_melodic: [],
    intimate_open: [],
    minimal_dense: [],
    electronic_organic: [],
  };
  const atmosphereValues: { value: string; weight: number }[] = [];
  const genreValues: { value: string; weight: number }[] = [];
  const engineValues: { value: string; weight: number }[] = [];
  const instrumentalValues: Weighted[] = [];
  const productionValues: Weighted[] = [];
  const genderValues: { value: string; weight: number }[] = [];
  const ownVoiceValues: Weighted[] = [];
  const voiceUsageValues: { value: string; weight: number }[] = [];
  const vocalScoreValues: Weighted[] = [];
  const lengthValues: Weighted[] = [];
  const compositionValues: Weighted[] = [];
  const languageValues: { value: string; weight: number }[] = [];
  const lyricWordValues: Weighted[] = [];
  const lyricScoreValues: Weighted[] = [];
  const lovedGenreValues: { value: string; weight: number }[] = [];
  const avoidedGenreValues: { value: string; weight: number }[] = [];
  const loveRateValues: Weighted[] = [];
  const overallValues: Weighted[] = [];

  // List traits report tracks, not tags, so they need their own counters: one
  // track can add several genres and would otherwise inflate the caption.
  let atmosphereTracks = 0;
  let genreTracks = 0;
  let engineTracks = 0;
  let instrumentTracks = 0;
  let lovedGenreTracks = 0;
  let avoidedGenreTracks = 0;

  for (const { track, weight } of weighted) {
    const audio = track.audioDna;
    const advanced: AdvancedDnaSummary | null = track.advancedDna;
    const genres = detectGenres(track.prompt);

    if (audio?.tempo != null && Number.isFinite(audio.tempo) && audio.tempo > 0) {
      tempoValues.push({ value: audio.tempo, weight });

      // Keep the promise next to the measurement. Only tracks where the two sit
      // an octave apart are counted, so a prompt that is simply vague does not
      // pollute the share.
      const intended = parsePromptBpm(track.prompt);
      if (intended !== null) {
        intendedTempoValues.push({ value: intended, weight });
        const relation = tempoOctaveRelation(audio.tempo, intended);
        if (relation !== null) {
          halfTimeValues.push({ value: relation === "half" ? 1 : 0, weight: 1 });
        }
      }
    }
    if (audio?.energy != null && Number.isFinite(audio.energy)) {
      energyValues.push({ value: audio.energy, weight });
    }

    // Arc and hook need the segment analysis added in phase 4; older rows have
    // neither until scripts/backfill-tempo.ts has re-measured them.
    const arcShape = classifyEnergyArc(audio?.energyArc);
    if (arcShape) {
      energyArcValues.push({ value: arcShape, weight });
    }
    if (audio?.hookEarly != null) {
      // A plain share of songs, like instrumental_share: weighting it by
      // rating would turn "hook early" into "hooks I happened to like".
      hookValues.push({ value: audio.hookEarly ? 1 : 0, weight: 1 });
    }

    // Spectra come from the user's own words, so they do not need audio DNA.
    for (const [key, score] of Object.entries(spectrumScores(track.prompt))) {
      spectrumValues[key as SpectrumKey].push({ value: score, weight });
    }
    if (audio?.atmosphereTags?.length) {
      atmosphereTracks += 1;
      for (const tag of audio.atmosphereTags) {
        atmosphereValues.push({ value: tag, weight });
      }
    }
    if (audio?.lyricsScore != null) {
      lyricScoreValues.push({ value: audio.lyricsScore, weight });
    }

    if (genres.length > 0) {
      genreTracks += 1;
      for (const genre of genres) {
        genreValues.push({ value: genre, weight });
      }
    }

    const instruments = detectInstruments(track.prompt);
    if (instruments.length > 0) {
      instrumentTracks += 1;
      for (const instrument of instruments) {
        instrumentValues.push({ value: instrument, weight });
      }
    }

    // Uploaded audio has no engine of its own, so it would answer "what do you
    // generate with?" with "Uploaded" — a non-answer. Provider ids are
    // normalised to their display names ("poyo" is Suno) to match the Studio.
    const engine = track.provider?.trim().toLowerCase();
    if (engine && engine !== "upload") {
      engineTracks += 1;
      engineValues.push({ value: PROVIDER_LABELS[engine] ?? capitalise(engine), weight });
    }

    // Shares are plain counts: weighting them by rating/plays would make
    // "60% instrumental" mean something other than 60% of the catalogue.
    instrumentalValues.push({ value: track.instrumental ? 1 : 0, weight: 1 });

    if (advanced?.productionScore != null) {
      productionValues.push({ value: advanced.productionScore, weight });
    }
    if (advanced?.vocalScore != null) {
      vocalScoreValues.push({ value: advanced.vocalScore, weight });
    }
    if (advanced?.compositionScore != null) {
      compositionValues.push({ value: advanced.compositionScore, weight });
    }
    if (advanced?.overallScore != null) {
      overallValues.push({ value: advanced.overallScore, weight });
    }

    if (!track.instrumental && track.vocalGender) {
      genderValues.push({ value: track.vocalGender, weight });
    }

    // Only tracks that recorded an answer count: pre-migration rows, other
    // providers and instrumentals are null, not "no".
    if (!track.instrumental && track.ownVoice !== null) {
      ownVoiceValues.push({ value: track.ownVoice ? 1 : 0, weight });
    }

    // Which voice actually sang it. Weighted like everything else, so a voice
    // used on tracks the user loved outranks one used on throwaways.
    if (!track.instrumental && track.voiceId) {
      voiceUsageValues.push({ value: track.voiceId, weight });
    }

    if (track.duration != null && track.duration > 0) {
      lengthValues.push({ value: track.duration, weight });
    }

    if (!track.instrumental && track.language) {
      languageValues.push({ value: track.language, weight });
    }

    const words = countWords(track.lyrics);
    if (words !== null) {
      lyricWordValues.push({ value: words, weight });
    }

    if (track.rating === "up" || track.rating === "down") {
      if (track.rating === "up") {
        loveRateValues.push({ value: 1, weight: 1 });
        if (genres.length > 0) {
          lovedGenreTracks += 1;
          for (const genre of genres) lovedGenreValues.push({ value: genre, weight });
        }
      } else {
        loveRateValues.push({ value: 0, weight: 1 });
        if (genres.length > 0) {
          avoidedGenreTracks += 1;
          for (const genre of genres) avoidedGenreValues.push({ value: genre, weight });
        }
      }
    }
  }

  // Tracks that named a voice, not the number of voices, for the card caption.
  const voiceTracks = voiceUsageValues.filter((entry) => entry.weight > 0).length;

  const traits: (DnaTrait | null)[] = [
    // ── Sound ────────────────────────────────────────────────────────────────
    numericTrait({
      key: "tempo",
      category: "sound",
      label: "Tempo",
      values: tempoValues,
      unit: "BPM",
      spreadScale: 40,
      format: (value) => `${Math.round(value)} BPM`,
    }),
    numericTrait({
      key: "tempo_intent",
      category: "sound",
      label: "Intended tempo",
      values: intendedTempoValues,
      unit: "BPM",
      spreadScale: 40,
      format: (value) => `${Math.round(value)} BPM`,
    }),
    ratioTrait({
      key: "half_time_share",
      category: "sound",
      label: "Half-time",
      values: halfTimeValues,
      display: (ratio) => `${Math.round(ratio * 100)}% half-time`,
    }),
    numericTrait({
      key: "energy",
      category: "sound",
      label: "Energy",
      values: energyValues,
      unit: null,
      spreadScale: 30,
      format: (value) => `${Math.round(value)}/100`,
    }),
    textTrait({
      key: "energy_arc",
      category: "sound",
      label: "Energy arc",
      values: energyArcValues,
    }),
    ...SPECTRA.map((definition) => spectrumTrait(definition, spectrumValues[definition.key])),
    listTrait({
      key: "atmospheres",
      category: "sound",
      label: "Atmospheres",
      values: atmosphereValues,
      limit: 3,
      sourceCount: atmosphereTracks,
    }),
    listTrait({
      key: "genres",
      category: "sound",
      label: "Genres",
      values: genreValues,
      limit: 3,
      sourceCount: genreTracks,
    }),
    listTrait({
      key: "signature_instruments",
      category: "sound",
      label: "Signature instruments",
      values: instrumentValues,
      limit: 3,
      sourceCount: instrumentTracks,
      displayValue: instrumentDisplay,
    }),
    listTrait({
      key: "preferred_engine",
      category: "sound",
      label: "Preferred engine",
      values: engineValues,
      limit: 3,
      sourceCount: engineTracks,
      displayValue: engineDisplay,
    }),
    ratioTrait({
      key: "instrumental_share",
      category: "sound",
      label: "Instrumentals",
      values: instrumentalValues,
      display: (ratio) => `${Math.round(ratio * 100)}% instrumental`,
    }),
    numericTrait({
      key: "production_score",
      category: "sound",
      label: "Production score",
      values: productionValues,
      unit: "/10",
      spreadScale: 4,
      format: (value) => `${round1(value)}/10`,
    }),

    // ── Voice ────────────────────────────────────────────────────────────────
    textTrait({
      key: "vocal_gender",
      category: "voice",
      label: "Vocal gender",
      values: genderValues,
    }),
    ratioTrait({
      key: "own_voice",
      category: "voice",
      label: "Own voice",
      values: ownVoiceValues,
      display: (ratio) => `${Math.round(ratio * 100)}% with your cloned voice`,
    }) ?? ownVoiceTrait(options.voice ?? null),
    favoriteVoicesTrait(voiceUsageValues, voiceTracks, options.voice ?? null),
    numericTrait({
      key: "vocal_score",
      category: "voice",
      label: "Vocal strength",
      values: vocalScoreValues,
      unit: "/10",
      spreadScale: 4,
      format: (value) => `${round1(value)}/10`,
    }),

    // ── Structure ────────────────────────────────────────────────────────────
    ratioTrait({
      key: "hook_before_30",
      category: "structure",
      label: "Hook before 0:30",
      values: hookValues,
      display: (ratio) => `${Math.round(ratio * 100)}% hook in the first 30s`,
    }),
    numericTrait({
      key: "length",
      category: "structure",
      label: "Average length",
      values: lengthValues,
      unit: "s",
      spreadScale: 90,
      format: (value) => formatDuration(value),
    }),
    numericTrait({
      key: "composition_score",
      category: "structure",
      label: "Composition score",
      values: compositionValues,
      unit: "/10",
      spreadScale: 4,
      format: (value) => `${round1(value)}/10`,
    }),

    // ── Words ────────────────────────────────────────────────────────────────
    textTrait({
      key: "language",
      category: "words",
      label: "Language",
      values: languageValues,
    }),
    numericTrait({
      key: "lyric_words",
      category: "words",
      label: "Lyrics per song",
      values: lyricWordValues,
      unit: "words",
      spreadScale: 120,
      format: (value) => `${Math.round(value)} words`,
    }),
    numericTrait({
      key: "lyric_score",
      category: "words",
      label: "Lyric score",
      values: lyricScoreValues,
      unit: "/10",
      spreadScale: 4,
      format: (value) => `${round1(value)}/10`,
    }),

    // ── Taste ────────────────────────────────────────────────────────────────
    libraryTrait({
      key: "writing_style_dna",
      category: "taste",
      label: "Writing style DNA",
      names: options.library?.writingTitles ?? [],
    }),
    libraryTrait({
      key: "music_style_dna",
      category: "taste",
      label: "Music style DNA",
      names: options.library?.musicNames ?? [],
    }),
    listTrait({
      key: "loved_genres",
      category: "taste",
      label: "Genres you love",
      values: lovedGenreValues,
      limit: 3,
      sourceCount: lovedGenreTracks,
    }),
    listTrait({
      key: "avoided_genres",
      category: "taste",
      label: "Genres you skip",
      values: avoidedGenreValues,
      limit: 3,
      sourceCount: avoidedGenreTracks,
    }),
    ratioTrait({
      key: "love_rate",
      category: "taste",
      label: "Loved share",
      values: loveRateValues,
      display: (ratio) => `${Math.round(ratio * 100)}% of rated tracks loved`,
    }),
    numericTrait({
      key: "overall_score",
      category: "taste",
      label: "Overall score",
      values: overallValues,
      unit: "/10",
      spreadScale: 4,
      format: (value) => `${round1(value)}/10`,
    }),
  ];

  const builtTraits = traits.filter((trait): trait is DnaTrait => trait !== null);

  const tempoTrait = builtTraits.find((trait) => trait.key === "tempo") ?? null;
  const energyTrait = builtTraits.find((trait) => trait.key === "energy") ?? null;
  const atmosphereTrait = builtTraits.find((trait) => trait.key === "atmospheres") ?? null;
  const genreTrait = builtTraits.find((trait) => trait.key === "genres") ?? null;
  const languageTrait = builtTraits.find((trait) => trait.key === "language") ?? null;
  const genderTrait = builtTraits.find((trait) => trait.key === "vocal_gender") ?? null;

  const readList = (trait: DnaTrait | null): string[] => {
    if (!trait?.valueText) return [];
    try {
      const parsed: unknown = JSON.parse(trait.valueText);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  };

  const profile: DnaProfileSummary = {
    name: buildName({
      tempo: tempoTrait?.valueNumber ?? null,
      genres: readList(genreTrait),
      atmospheres: readList(atmosphereTrait),
      instrumentalOnly: withVocals.length === 0,
    }),
    summary: buildSummary({
      sourceCount: usable.length,
      ratedCount: rated.length,
      likedCount: liked.length,
      tempo: tempoTrait?.valueNumber ?? null,
      energy: energyTrait?.valueNumber ?? null,
      vocalGender: genderTrait?.valueText ?? null,
      language: languageTrait?.valueText ?? null,
      atmospheres: readList(atmosphereTrait),
      genres: readList(genreTrait),
    }),
    sourceCount: usable.length,
    ratedCount: rated.length,
    likedCount: liked.length,
    dislikedCount: disliked.length,
  };

  // Stable, predictable order: category order, then the order the builders
  // declared (which is the order the UI renders).
  const categoryOrder: DnaCategory[] = ["sound", "voice", "structure", "words", "taste"];
  builtTraits.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));

  return { profile, traits: builtTraits };
}
