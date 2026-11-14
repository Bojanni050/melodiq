import { describe, expect, it } from "vitest";

import { buildDnaProfile, detectGenres, sourceWeight } from "../dna/aggregate";
import type { DnaSourceTrack } from "../dna/types";

let idCounter = 0;

function makeTrack(overrides: Partial<DnaSourceTrack> = {}): DnaSourceTrack {
  idCounter += 1;
  return {
    id: `track-${idCounter}`,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    duration: 210,
    prompt: "pop, warm synths",
    lyrics: "a line of lyrics here",
    language: "en",
    instrumental: false,
    vocalGender: "female",
    rating: null,
    playCount: 0,
    archivedAt: null,
    hiddenAt: null,
    audioDna: {
      tempo: 84,
      key: "C major",
      energy: 45,
      loudness: -12,
      atmosphereTags: ["nostalgic", "warm"],
      lyricsScore: 7,
      lyricsNotes: null,
      compositionScore: 7,
      compositionNotes: null,
      computedAt: "2026-01-01T00:00:00Z",
    },
    advancedDna: {
      compositionScore: 7.5,
      vocalScore: 7,
      productionScore: 7.5,
      overallScore: 7.4,
    },
    ...overrides,
  };
}

const now = new Date("2026-06-01T00:00:00Z");

function trait(result: ReturnType<typeof buildDnaProfile>, key: string) {
  return result.traits.find((item) => item.key === key) ?? null;
}

describe("buildDnaProfile", () => {
  it("returns an explicit empty profile instead of inventing traits", () => {
    const result = buildDnaProfile([], { now });

    expect(result.traits).toHaveLength(0);
    expect(result.profile.sourceCount).toBe(0);
    expect(result.profile.name).toBe("Not enough tracks yet");
    expect(result.profile.summary).toMatch(/needs a few finished tracks/i);
  });

  it("weights rated tracks more heavily than unrated ones", () => {
    const result = buildDnaProfile(
      [
        makeTrack({ rating: "up", audioDna: { ...makeTrack().audioDna!, tempo: 120 } }),
        makeTrack({ audioDna: { ...makeTrack().audioDna!, tempo: 80 } }),
      ],
      { now },
    );

    // (120*3 + 80) / 4 = 110
    expect(trait(result, "tempo")?.valueNumber).toBe(110);
    expect(result.profile.ratedCount).toBe(1);
    expect(result.profile.likedCount).toBe(1);
  });

  it("gains confidence with more evidence and loses it when tracks disagree", () => {
    const one = buildDnaProfile([makeTrack()], { now });
    const many = buildDnaProfile(
      Array.from({ length: 12 }, () => makeTrack()),
      { now },
    );
    const scattered = buildDnaProfile(
      Array.from({ length: 12 }, (_, index) =>
        makeTrack({ audioDna: { ...makeTrack().audioDna!, tempo: 60 + index * 12 } }),
      ),
      { now },
    );

    expect(trait(many, "tempo")!.confidence).toBeGreaterThan(trait(one, "tempo")!.confidence);
    expect(trait(scattered, "tempo")!.confidence).toBeLessThan(trait(many, "tempo")!.confidence);
  });

  it("skips traits that have no supporting signal", () => {
    const result = buildDnaProfile(
      [
        makeTrack({
          lyrics: null,
          language: null,
          audioDna: { ...makeTrack().audioDna!, tempo: null, energy: null, lyricsScore: null },
          advancedDna: null,
        }),
      ],
      { now },
    );

    expect(trait(result, "tempo")).toBeNull();
    expect(trait(result, "energy")).toBeNull();
    expect(trait(result, "language")).toBeNull();
    expect(trait(result, "production_score")).toBeNull();
    // Prompt-derived traits survive because the prompt itself is the evidence.
    expect(trait(result, "genres")).not.toBeNull();
  });

  it("reads genres, languages and atmospheres from the catalogue", () => {
    const result = buildDnaProfile([makeTrack(), makeTrack({ prompt: "synthpop, dream pop" })], { now });

    expect(result.traits.find((item) => item.key === "genres")?.display).toContain("pop");
    expect(trait(result, "language")?.display).toBe("English 100%");
    expect(trait(result, "atmospheres")?.display).toBe("nostalgic, warm");
    expect(result.profile.name).toBe("Midtempo nostalgic dream pop");
    expect(result.profile.summary).toContain("84 BPM");
  });

  it("derives loved and skipped genres from explicit ratings", () => {
    const result = buildDnaProfile(
      [
        makeTrack({ prompt: "synthpop, dreamy", rating: "up" }),
        makeTrack({ prompt: "synthpop, dreamy", rating: "up" }),
        makeTrack({ prompt: "edm, hardstyle", rating: "down" }),
      ],
      { now },
    );

    expect(trait(result, "loved_genres")?.display).toContain("synthpop");
    expect(trait(result, "avoided_genres")?.display).toContain("edm");
    expect(trait(result, "love_rate")?.valueNumber).toBe(66.7);
  });

  it("measures how much of the catalogue is instrumental", () => {
    const result = buildDnaProfile(
      [makeTrack(), makeTrack({ instrumental: true }), makeTrack(), makeTrack({ instrumental: true })],
      { now },
    );

    expect(trait(result, "instrumental_share")?.valueNumber).toBe(50);
    expect(trait(result, "instrumental_share")?.display).toBe("50% instrumental");
  });

  it("formats the average track length as minutes:seconds", () => {
    const result = buildDnaProfile(
      [makeTrack({ duration: 180 }), makeTrack({ duration: 240 })],
      { now },
    );

    expect(trait(result, "length")?.display).toBe("3:30");
  });

  it("is deterministic for identical input", () => {
    const sources = [makeTrack(), makeTrack({ rating: "up" }), makeTrack({ instrumental: true })];

    expect(buildDnaProfile(sources, { now })).toEqual(buildDnaProfile(sources, { now }));
  });
});

describe("sourceWeight", () => {
  it("ranks loved tracks above unrated ones and demotes disliked tracks", () => {
    const loved = sourceWeight(makeTrack({ rating: "up" }), now);
    const plain = sourceWeight(makeTrack(), now);
    const disliked = sourceWeight(makeTrack({ rating: "down" }), now);

    expect(loved).toBeGreaterThan(plain);
    expect(disliked).toBeLessThan(plain);
  });

  it("fades older tracks but never below the floor", () => {
    const recent = sourceWeight(makeTrack({ createdAt: new Date("2026-05-01T00:00:00Z") }), now);
    const old = sourceWeight(makeTrack({ createdAt: new Date("2020-01-01T00:00:00Z") }), now);

    expect(old).toBeLessThan(recent);
    expect(old).toBeGreaterThan(0);
  });

  it("counts archived tracks as weaker evidence", () => {
    const visible = sourceWeight(makeTrack(), now);
    const archived = sourceWeight(makeTrack({ archivedAt: new Date("2026-05-01T00:00:00Z") }), now);

    expect(archived).toBeLessThan(visible);
  });
});

describe("detectGenres", () => {
  it("matches whole tags only, so 'pop' does not fire inside 'synthpop'", () => {
    expect(detectGenres("synthpop, dreamy")).not.toContain("pop");
    expect(detectGenres("synthpop, dreamy")).toContain("synthpop");
  });

  it("handles punctuation, casing and hyphenated tags", () => {
    expect(detectGenres("Lo-Fi, Hip-Hop, R&B")).toEqual(expect.arrayContaining(["lo-fi", "hip hop", "r&b"]));
  });

  it("returns nothing for an empty prompt", () => {
    expect(detectGenres(null)).toEqual([]);
    expect(detectGenres("")).toEqual([]);
  });
});
