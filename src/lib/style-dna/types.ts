/**
 * Writing DNA — the per-track features behind the `words` traits of Melody DNA.
 *
 * Everything in this module is pure: no database, no React, no network. The
 * features are deliberately deterministic and approximate in the same places a
 * listener would be: rhyme is judged on spelling-derived sound classes, not on a
 * pronunciation dictionary, so the values are signals about *how* the user
 * writes rather than a verdict on any single line.
 */

export type WritingLanguage = "en" | "nl" | "es" | "pt" | "fr" | "de" | "it" | "xx";

export type WritingPov = "first" | "second" | "third" | "mixed";

export type WritingTense = "past" | "present" | "mixed";

export type WritingFeatures = {
  language: WritingLanguage;
  /** Lines with at least one content word. */
  lineCount: number;
  wordCount: number;
  /** Mean syllables per line; null when no line could be counted. */
  avgSyllables: number | null;
  /** Standard deviation of syllables per line; null when fewer than 2 lines. */
  syllableSpread: number | null;
  /** Most common rhyme scheme across sections, e.g. "ABAB". */
  rhymeScheme: string | null;
  /** Share of lines that rhyme with another line in the same section (0..1). */
  rhymeDensity: number | null;
  /** Share of lines carrying an internal rhyme (0..1). */
  internalRhyme: number | null;
  /** Share of rhyming pairs whose rhyme tail spans two or more syllables (0..1). */
  multisyllabicRhyme: number | null;
  pov: WritingPov | null;
  /** Null for languages without a tense marker list — the trait stays dark. */
  tense: WritingTense | null;
  /** Share of lines containing explicit language (0..1). */
  explicitness: number | null;
  /**
   * Section order as single-letter codes, e.g. "v-c-v-c-b-c-o". Null when the
   * lyrics carry no recognisable section headings at all.
   */
  sectionStructure: string | null;
  /** Mean number of lines per chorus; null when the song has no chorus. */
  chorusLines: number | null;
  /** Share of lines that appear more than once in the same song (0..1). */
  repetition: number | null;
  /** Share of lines carrying a parenthetical ad-lib, e.g. "(yeah)" (0..1). */
  adLibs: number | null;
  /** Whether the song has a bridge section. */
  hasBridge: boolean;
  /** Distinct content words, capped; used for document-frequency aggregation. */
  contentWords: string[];
  /** Theme slugs mapped from keyword families. */
  themes: string[];
};

export type LyricSection = {
  label: string;
  lines: string[];
};

export type WritingFeatureInput = {
  lyrics: string | null | undefined;
  /** Free text ("English", "en") or a bare code; unknown values fall back to generic. */
  language: string | null | undefined;
};
