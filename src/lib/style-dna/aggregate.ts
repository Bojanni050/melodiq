import type { DnaCategory, DnaTrait } from "@/lib/dna/types";
import {
  LYRIC_SPECTRA,
  type LyricSpectrumDefinition,
} from "@/lib/dna/lyric-spectra";
import { extractWritingFeatures } from "@/lib/style-dna/features";
import type { WritingFeatures, WritingLanguage } from "@/lib/style-dna/types";

/**
 * Writing DNA aggregation — `WritingFeatures` per track becomes the `words`
 * traits of Melody DNA.
 *
 * Kept separate from `dna/aggregate.ts` on purpose: that module owns the audio
 * side of the profile (tempo, energy, genres) and is rebuilt from `DnaSourceTrack`.
 * This one only needs the extracted features, so it stays pure and can be tested
 * without a database or a catalogue.
 *
 * Two conventions inherited from `dna/aggregate.ts`:
 * - confidence is `coverage(n) * agreement`, so two tracks can never look as
 *   certain as forty (`coverage = n / (n + 3)`);
 * - missing signals produce no trait at all, never a zero — the UI shows
 *   "still learning" instead of inventing a number.
 *
 * Rhyme and cadence are language-bound, so every trait is also produced per
 * language with a `:nl`-style key suffix. Only languages with at least
 * `MIN_LANGUAGE_TRACKS` usable texts get their own set; a handful of texts would
 * only add confident-looking noise. The overall set (bare keys) stays the
 * complete picture, `writing_languages` included.
 */

/** Mirrors the constant in `dna/aggregate.ts`; tracks needed for half coverage. */
const COVERAGE_HALF_POINT = 3;

/** Fewer texts than this in a language → no per-language traits. */
export const MIN_LANGUAGE_TRACKS = 5;

/** Separates a trait from its language, e.g. `rhyme_density:nl`. */
export const LANGUAGE_KEY_SEPARATOR = ":";

/** Mirrors `MIN_SPECTRUM_SOURCES` in `dna/aggregate.ts`: one song is not a profile. */
const MIN_SPECTRUM_SOURCES = 3;

/** Signature words and themes are top-N lists in the UI, not full dumps. */
const SIGNATURE_WORD_LIMIT = 12;
const THEME_LIMIT = 6;
const LANGUAGE_LIMIT = 8;

const LANGUAGE_LABELS: Record<WritingLanguage, string> = {
  en: "English",
  nl: "Dutch",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  xx: "Other",
};

export type WritingDnaSource = {
  features: WritingFeatures;
  /** Same recency/rating weight the rest of the DNA uses (see sourceWeight). */
  weight: number;
};

/**
 * What the aggregator needs from a track to build writing features. Deliberately
 * narrower than `DnaSourceTrack` so this module never depends on the audio side
 * of the profile — the repository maps its sources onto this shape.
 */
export type WritingSourceTrack = {
  lyrics: string | null;
  language: string | null;
  weight: number;
};

/** Extracts features for every track that has a usable text; the rest are dropped. */
export function collectWritingSources(tracks: WritingSourceTrack[]): WritingDnaSource[] {
  const sources: WritingDnaSource[] = [];
  for (const track of tracks) {
    if (track.weight <= 0) continue;
    const features = extractWritingFeatures({ lyrics: track.lyrics, language: track.language });
    if (!features) continue;
    sources.push({ features, weight: track.weight });
  }
  return sources;
}

export type WritingDnaLanguage = {
  language: WritingLanguage;
  sourceCount: number;
  traits: DnaTrait[];
};

export type WritingDnaResult = {
  /** Per-language trait sets, keys suffixed with `:<lang>`. */
  byLanguage: WritingDnaLanguage[];
  /** Whole-catalogue writing traits, bare keys. */
  overall: DnaTrait[];
  /** Section-level traits for the `structure` category, bare keys. */
  structure: DnaTrait[];
};

type Weighted = { value: number; weight: number };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function coverage(count: number): number {
  if (count <= 0) return 0;
  return count / (count + COVERAGE_HALF_POINT);
}

function weightedStats(samples: Weighted[]): { mean: number; spread: number; weight: number } | null {
  const usable = samples.filter((sample) => Number.isFinite(sample.value) && sample.weight > 0);
  if (usable.length === 0) return null;
  const totalWeight = usable.reduce((sum, sample) => sum + sample.weight, 0);
  if (totalWeight <= 0) return null;
  const mean = usable.reduce((sum, sample) => sum + sample.value * sample.weight, 0) / totalWeight;
  const variance = usable.reduce((sum, sample) => sum + sample.weight * (sample.value - mean) ** 2, 0) / totalWeight;
  return { mean, spread: Math.sqrt(variance), weight: totalWeight };
}

function weightedCounts(
  entries: { value: string; weight: number }[],
): { value: string; weight: number; count: number }[] {
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

function ratioTrait(options: {
  key: string;
  label: string;
  values: Weighted[];
  display: (ratio: number) => string;
  /** Defaults to `words`; structure traits reuse the same confidence rules. */
  category?: DnaCategory;
}): DnaTrait | null {
  const stats = weightedStats(options.values);
  if (!stats) return null;
  const sourceCount = options.values.filter((sample) => sample.weight > 0).length;
  const ratio = clamp01(stats.mean);
  return {
    key: options.key,
    category: options.category ?? "words",
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

function numericTrait(options: {
  key: string;
  label: string;
  values: Weighted[];
  spreadScale: number;
  format: (value: number) => string;
  /** Spectra sit on a 0..100 line and show "%"; averages leave it null. */
  unit?: string | null;
  category?: DnaCategory;
}): DnaTrait | null {
  const stats = weightedStats(options.values);
  if (!stats) return null;
  const sourceCount = options.values.filter((sample) => sample.weight > 0).length;
  const agreement = clamp01(1 - stats.spread / options.spreadScale);
  return {
    key: options.key,
    category: options.category ?? "words",
    label: options.label,
    kind: "number",
    valueNumber: round1(stats.mean),
    valueText: null,
    unit: options.unit ?? null,
    display: options.format(stats.mean),
    confidence: round1(clamp01(coverage(sourceCount) * Math.max(0.3, agreement)) * 100) / 100,
    sourceCount,
    weight: round1(stats.weight),
  };
}

function textTrait(options: {
  key: string;
  label: string;
  values: { value: string; weight: number }[];
  labels?: Record<string, string>;
  category?: DnaCategory;
}): DnaTrait | null {
  const ranked = weightedCounts(options.values);
  if (ranked.length === 0) return null;
  const totalWeight = ranked.reduce((sum, item) => sum + item.weight, 0);
  const sourceCount = ranked.reduce((sum, item) => sum + item.count, 0);
  const top = ranked[0];
  const share = totalWeight > 0 ? top.weight / totalWeight : 0;
  const value = options.labels?.[top.value] ?? top.value;
  return {
    key: options.key,
    category: options.category ?? "words",
    label: options.label,
    kind: "text",
    valueNumber: round1(share * 100),
    valueText: value,
    unit: null,
    display: `${value} ${Math.round(share * 100)}%`,
    confidence: round1(clamp01(coverage(sourceCount) * Math.max(0.35, share)) * 100) / 100,
    sourceCount,
    weight: round1(totalWeight),
  };
}

function listTrait(options: {
  key: string;
  label: string;
  values: { value: string; weight: number }[];
  limit: number;
  /** Tracks that carried at least one value, not the number of values. */
  sourceCount: number;
}): DnaTrait | null {
  const ranked = weightedCounts(options.values);
  if (ranked.length === 0) return null;
  const top = ranked.slice(0, options.limit);
  const totalWeight = ranked.reduce((sum, item) => sum + item.weight, 0);
  const agreement = totalWeight > 0 ? top[0].weight / totalWeight : 0;
  return {
    key: options.key,
    category: "words" as DnaCategory,
    label: options.label,
    kind: "list",
    valueNumber: round1(agreement * 100),
    valueText: JSON.stringify(top.map((item) => item.value)),
    unit: null,
    display: top.map((item) => item.value).join(", "),
    confidence: round1(clamp01(coverage(options.sourceCount) * Math.max(0.35, agreement)) * 100) / 100,
    sourceCount: options.sourceCount,
    weight: round1(totalWeight),
  };
}

function buildTraits(sources: WritingDnaSource[], suffix: string): DnaTrait[] {
  const usable = sources.filter((source) => source.weight > 0);
  const trait = (base: string) => `${base}${suffix}`;
  const withSuffix = (label: string) =>
    suffix ? `${label} (${suffix.slice(LANGUAGE_KEY_SEPARATOR.length).toUpperCase()})` : label;

  const numbers = (pick: (features: WritingFeatures) => number | null): Weighted[] =>
    usable
      .map((source) => ({ value: pick(source.features), weight: source.weight }))
      .filter((sample): sample is Weighted => sample.value !== null);

  const textValues = (
    pick: (features: WritingFeatures) => string | null,
  ): { value: string; weight: number }[] =>
    usable
      .map((source) => ({ value: pick(source.features), weight: source.weight }))
      .filter((entry): entry is { value: string; weight: number } => entry.value !== null);

  const listValues = (
    pick: (features: WritingFeatures) => string[] | null,
  ): { values: { value: string; weight: number }[]; sourceCount: number } => {
    const values: { value: string; weight: number }[] = [];
    let sourceCount = 0;
    for (const source of usable) {
      const picked = pick(source.features);
      if (!picked || picked.length === 0) continue;
      sourceCount += 1;
      for (const value of picked) values.push({ value, weight: source.weight });
    }
    return { values, sourceCount };
  };

  const signatures = listValues((features) => features.contentWords);
  const themes = listValues((features) => features.themes);

  /**
   * A writing-style spectrum: the weighted mean position across songs. Same
   * rules as the audio spectra — a handful of songs is not a profile, and the
   * spread between them lowers the confidence instead of hiding disagreement.
   */
  const spectrumTrait = (definition: LyricSpectrumDefinition): DnaTrait | null => {
    const values = usable
      .map((source) => ({
        value: source.features.lyricSpectra?.[definition.key] ?? null,
        weight: source.weight,
      }))
      .filter((sample): sample is Weighted => sample.value !== null);
    if (values.filter((sample) => sample.weight > 0).length < MIN_SPECTRUM_SOURCES) return null;

    return numericTrait({
      key: trait(definition.key),
      label: withSuffix(capitalise(`${definition.left} ↔ ${definition.right}`)),
      values,
      spreadScale: 60,
      unit: "%",
      // Show the share of the side the song actually leans to: a song at 25 on
      // the line is 75% colloquial, not "25% colloquial".
      format: (value) => {
        const rounded = Math.round(value);
        return value >= 50
          ? `${rounded}% ${definition.right}`
          : `${100 - rounded}% ${definition.left}`;
      },
    });
  };

  const traits: (DnaTrait | null)[] = [
    // Style spectra first: they describe the writing as a whole, the rhyme and
    // cadence traits below zoom in on the mechanics.
    ...LYRIC_SPECTRA.map(spectrumTrait),
    textTrait({
      key: trait("rhyme_scheme"),
      label: withSuffix("Rhyme scheme"),
      values: textValues((features) => features.rhymeScheme),
    }),
    ratioTrait({
      key: trait("rhyme_density"),
      label: withSuffix("Rhyme density"),
      values: numbers((features) => features.rhymeDensity),
      display: (ratio) => `${Math.round(ratio * 100)}% of lines rhyme`,
    }),
    ratioTrait({
      key: trait("internal_rhyme"),
      label: withSuffix("Internal rhyme"),
      values: numbers((features) => features.internalRhyme),
      display: (ratio) => `${Math.round(ratio * 100)}% of lines rhyme inside the line`,
    }),
    ratioTrait({
      key: trait("multisyllabic_rhyme"),
      label: withSuffix("Multisyllabic rhyme"),
      values: numbers((features) => features.multisyllabicRhyme),
      display: (ratio) => `${Math.round(ratio * 100)}% of rhymes span two syllables`,
    }),
    numericTrait({
      key: trait("line_syllables"),
      label: withSuffix("Line length"),
      values: numbers((features) => features.avgSyllables),
      spreadScale: 3,
      format: (value) => `${round1(value)} syllables/line`,
    }),
    numericTrait({
      key: trait("line_length_spread"),
      label: withSuffix("Line length spread"),
      values: numbers((features) => features.syllableSpread),
      spreadScale: 2,
      format: (value) => `±${round1(value)} syllables`,
    }),
    textTrait({
      key: trait("pov"),
      label: withSuffix("Point of view"),
      values: textValues((features) => features.pov),
    }),
    textTrait({
      key: trait("tense"),
      label: withSuffix("Tense"),
      values: textValues((features) => features.tense),
    }),
    ratioTrait({
      key: trait("explicitness"),
      label: withSuffix("Explicit language"),
      values: numbers((features) => features.explicitness),
      display: (ratio) => `${Math.round(ratio * 100)}% of lines are explicit`,
    }),
    listTrait({
      key: trait("signature_words"),
      label: withSuffix("Signature words"),
      values: signatures.values,
      limit: SIGNATURE_WORD_LIMIT,
      sourceCount: signatures.sourceCount,
    }),
    listTrait({
      key: trait("themes"),
      label: withSuffix("Themes"),
      values: themes.values,
      limit: THEME_LIMIT,
      sourceCount: themes.sourceCount,
    }),
    // Languages only make sense once, over the whole catalogue.
    suffix
      ? null
      : listTrait({
          key: "writing_languages",
          label: "Languages you write in",
          values: usable.map((source) => ({ value: source.features.language, weight: source.weight })),
          limit: LANGUAGE_LIMIT,
          sourceCount: usable.length,
        }),
  ];

  return traits.filter((entry): entry is DnaTrait => entry !== null);
}

/**
 * Section-level traits — how the songs are built rather than how they are
 * written. These live in the `structure` category and are deliberately not split
 * per language: a verse-chorus-bridge order is the same shape in every language.
 */
function buildStructureTraits(sources: WritingDnaSource[]): DnaTrait[] {
  const usable = sources.filter((source) => source.weight > 0);

  const numbers = (pick: (features: WritingFeatures) => number | null): Weighted[] =>
    usable
      .map((source) => ({ value: pick(source.features), weight: source.weight }))
      .filter((sample): sample is Weighted => sample.value !== null);

  const structures = usable
    .map((source) => ({ value: source.features.sectionStructure, weight: source.weight }))
    .filter((entry): entry is { value: string; weight: number } => entry.value !== null);

  const traits: (DnaTrait | null)[] = [
    textTrait({
      key: "song_structure",
      label: "Favorite structure",
      values: structures,
      category: "structure",
    }),
    numericTrait({
      key: "chorus_lines",
      label: "Chorus length",
      values: numbers((features) => features.chorusLines),
      spreadScale: 3,
      format: (value) => `${round1(value)} lines`,
      category: "structure",
    }),
    ratioTrait({
      key: "repetition",
      label: "Repetition",
      values: numbers((features) => features.repetition),
      display: (ratio) => `${Math.round(ratio * 100)}% of lines repeat`,
      category: "structure",
    }),
    ratioTrait({
      key: "ad_libs",
      label: "Ad-libs",
      values: numbers((features) => features.adLibs),
      display: (ratio) => `${Math.round(ratio * 100)}% of lines carry ad-libs`,
      category: "structure",
    }),
    ratioTrait({
      key: "bridge",
      label: "Bridge",
      values: usable.map((source) => ({ value: source.features.hasBridge ? 1 : 0, weight: source.weight })),
      display: (ratio) => `${Math.round(ratio * 100)}% of songs have a bridge`,
      category: "structure",
    }),
  ];

  return traits.filter((entry): entry is DnaTrait => entry !== null);
}

export function buildWritingDna(sources: WritingDnaSource[]): WritingDnaResult {
  const overall = buildTraits(sources, "");
  const structure = buildStructureTraits(sources);

  const groups = new Map<WritingLanguage, WritingDnaSource[]>();
  for (const source of sources) {
    if (source.weight <= 0) continue;
    const bucket = groups.get(source.features.language);
    if (bucket) bucket.push(source);
    else groups.set(source.features.language, [source]);
  }

  const byLanguage = [...groups.entries()]
    // "xx" is the unknown-language bucket, not a language: a per-language set for
    // it would be noise dressed up as a trait. It stays in the overall profile.
    .filter(([language, group]) => language !== "xx" && group.length >= MIN_LANGUAGE_TRACKS)
    .map(([language, group]) => ({
      language,
      sourceCount: group.length,
      traits: buildTraits(group, `${LANGUAGE_KEY_SEPARATOR}${language}`),
    }))
    .sort((a, b) => b.sourceCount - a.sourceCount || a.language.localeCompare(b.language));

  return { byLanguage, overall, structure };
}

/** Language name for the UI, mirroring the map in `dna/aggregate.ts`. */
export function writingLanguageLabel(language: WritingLanguage): string {
  return LANGUAGE_LABELS[language] ?? LANGUAGE_LABELS.xx;
}
