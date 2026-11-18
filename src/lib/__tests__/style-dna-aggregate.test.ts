import { describe, expect, it } from "vitest";
import {
  buildWritingDna,
  collectWritingSources,
  MIN_LANGUAGE_TRACKS,
  type WritingDnaSource,
} from "@/lib/style-dna/aggregate";
import { extractWritingFeatures } from "@/lib/style-dna/features";
import type { WritingLanguage } from "@/lib/style-dna/types";

function source(lyrics: string, language: string, weight = 1): WritingDnaSource {
  const features = extractWritingFeatures({ lyrics, language });
  if (!features) throw new Error(`fixture produced no features: ${lyrics}`);
  return { features, weight };
}

/** A rhyming couplet in the requested language, so several tracks can agree. */
function couplet(language: WritingLanguage, line: string): string {
  return `[Verse 1]\n${line}\n${line.replace(/go$/, "show")}`;
}

const EN_TRACKS: WritingDnaSource[] = [
  source("[Verse 1]\nI keep the light on when I go\nI never learned to let it show", "English"),
  source("[Verse 1]\nThe night is cold and I walk slow\nI keep the letters that you wrote", "English"),
  source("[Verse 1]\nI feel the morning on my face\nI leave the door open in case", "English"),
  source("[Verse 1]\nWe knew the words but not the tune\nI still remember every June", "English"),
  source("[Verse 1]\nYou said the truth and I said no\nI watched the river overflow", "English"),
];

describe("collectWritingSources", () => {
  it("drops tracks without a usable text and keeps the weight", () => {
    const collected = collectWritingSources([
      { lyrics: null, language: "en", weight: 1 },
      { lyrics: "[Verse 1]\nla", language: "en", weight: 2 },
      { lyrics: "[Verse 1]\nI keep the light on when I go\nI never learned to let it show", language: "en", weight: 3 },
      { lyrics: "[Verse 1]\nI keep the light on when I go\nI never learned to let it show", language: "en", weight: 0 },
    ]);
    expect(collected).toHaveLength(1);
    expect(collected[0].weight).toBe(3);
    expect(collected[0].features.language).toBe("en");
  });
});

describe("buildWritingDna", () => {
  it("returns nothing for an empty catalogue", () => {
    expect(buildWritingDna([])).toEqual({ byLanguage: [], overall: [] });
  });

  it("suffixes per-language keys and keeps the overall keys bare", () => {
    const result = buildWritingDna(EN_TRACKS);
    const english = result.byLanguage.find((entry) => entry.language === "en");
    expect(english).toBeDefined();
    expect(english?.traits.length).toBeGreaterThan(0);
    expect(english?.traits.every((trait) => trait.key.endsWith(":en"))).toBe(true);
    expect(result.overall.every((trait) => !trait.key.includes(":"))).toBe(true);
  });

  it("counts contributing tracks per trait", () => {
    const result = buildWritingDna(EN_TRACKS);
    const density = result.byLanguage[0].traits.find((trait) => trait.key.startsWith("rhyme_density"));
    expect(density?.sourceCount).toBe(EN_TRACKS.length);
    expect(density?.kind).toBe("ratio");
    expect(density?.unit).toBe("%");
  });

  it("covers the words traits from the spec", () => {
    const keys = buildWritingDna(EN_TRACKS).overall.map((trait) => trait.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "rhyme_scheme",
        "rhyme_density",
        "internal_rhyme",
        "multisyllabic_rhyme",
        "line_syllables",
        "line_length_spread",
        "pov",
        "tense",
        "explicitness",
        "signature_words",
        "themes",
        "writing_languages",
      ]),
    );
  });

  it("ranks signature words by how many tracks carry them, not by repetition", () => {
    const repeated = source(
      "[Verse 1]\nmidnight midnight midnight midnight\nmidnight midnight midnight midnight",
      "English",
    );
    const shared = [
      source("[Verse 1]\nriver runs through the valley\nriver carries all the stones", "English"),
      source("[Verse 1]\nriverside is where I met her\nriver told me not to go", "English"),
      source("[Verse 1]\nriver changes with the seasons\nriver never lets me sleep", "English"),
    ];
    const result = buildWritingDna([repeated, ...shared]);
    const trait = result.overall.find((item) => item.key === "signature_words");
    const words: string[] = JSON.parse(trait?.valueText ?? "[]");
    expect(words[0]).toBe("river");
  });

  it("lowers confidence for a two-track profile and raises it for twenty", () => {
    const small = buildWritingDna(EN_TRACKS.slice(0, 2)).overall.find((t) => t.key === "rhyme_density");
    const large = buildWritingDna(Array.from({ length: 5 }, () => EN_TRACKS).flat()).overall.find(
      (t) => t.key === "rhyme_density",
    );
    expect(small?.confidence ?? 0).toBeLessThan(large?.confidence ?? 0);
  });

  it("drops a language below the threshold from the per-language list but keeps it in the overall set", () => {
    const tracks = [
      ...EN_TRACKS,
      source("[Verse 1]\nIk was alleen en ik zag de maan\nWij waren stil en ik wist het al", "Dutch"),
    ];
    const result = buildWritingDna(tracks);
    expect(result.byLanguage.some((entry) => entry.language === "nl")).toBe(false);
    const languages = result.overall.find((trait) => trait.key === "writing_languages");
    const list: string[] = JSON.parse(languages?.valueText ?? "[]");
    expect(list).toContain("en");
    expect(list).toContain("nl");
  });

  it("never builds a per-language set for the unknown bucket", () => {
    const unknown: WritingDnaSource[] = Array.from({ length: MIN_LANGUAGE_TRACKS }, () =>
      source("[Verse 1]\nkaas is lekker en de maan is rond\nwij dansen samen in de straat", "xx"),
    );
    const result = buildWritingDna(unknown);
    expect(result.byLanguage).toEqual([]);
    expect(result.overall.length).toBeGreaterThan(0);
  });

  it("includes a language once it reaches the threshold", () => {
    const dutch: WritingDnaSource[] = Array.from({ length: MIN_LANGUAGE_TRACKS }, () =>
      source("[Verse 1]\nIk was alleen en ik zag de maan\nWij waren stil en ik wist het al", "nl"),
    );
    const result = buildWritingDna([...EN_TRACKS, ...dutch]);
    const entry = result.byLanguage.find((item) => item.language === "nl");
    expect(entry).toBeDefined();
    expect(entry?.traits.every((trait) => trait.key.endsWith(":nl"))).toBe(true);
  });

  it("ignores non-positive weights", () => {
    const result = buildWritingDna(EN_TRACKS.map((item, index) => ({ ...item, weight: index === 0 ? 0 : item.weight })));
    const density = result.overall.find((trait) => trait.key === "rhyme_density");
    expect(density?.sourceCount).toBe(EN_TRACKS.length - 1);
  });

  it("keeps the couplet fixture rhyming so the ratio traits are not null", () => {
    const result = buildWritingDna([source(couplet("en", "I let it go"), "en")]);
    const density = result.overall.find((trait) => trait.key === "rhyme_density");
    expect(density?.valueNumber).toBe(100);
  });
});
