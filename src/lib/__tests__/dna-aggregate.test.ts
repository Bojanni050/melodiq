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
    provider: "suno",
    lyrics: "a line of lyrics here",
    language: "en",
    instrumental: false,
    ownVoice: null,
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

  it("counts tracks, not tags, for list traits", () => {
    const audio = makeTrack().audioDna!;
    const result = buildDnaProfile(
      [
        makeTrack({
          prompt: "synthpop, dream pop",
          audioDna: { ...audio, atmosphereTags: ["warm", "nostalgic", "dreamy"] },
        }),
        makeTrack({ prompt: "pop", audioDna: { ...audio, atmosphereTags: [] } }),
      ],
      { now },
    );

    // Three genres and three atmosphere tags come from two tracks.
    expect(trait(result, "genres")?.sourceCount).toBe(2);
    expect(trait(result, "atmospheres")?.sourceCount).toBe(1);
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

  it("keeps the promised tempo next to the pulse it measured", () => {
    const dna = makeTrack().audioDna!;
    const withTempo = (tempo: number, prompt: string) =>
      makeTrack({ prompt, audioDna: { ...dna, tempo } });

    const result = buildDnaProfile(
      [
        // Half-time: promised 136, heard 68.
        withTempo(68, "half-time groove, syncopated kick, at 136 BPM"),
        // Waltz whose eighth notes the tracker locked onto.
        withTempo(118, "slow 3/4 at 58 BPM"),
        // On the grid, so it must not count towards the half-time share.
        withTempo(114, "pop, warm synths, 114 BPM"),
      ],
      { now },
    );

    expect(trait(result, "tempo")?.valueNumber).toBeCloseTo(100, 0);
    expect(trait(result, "tempo_intent")?.valueNumber).toBeCloseTo(102.7, 0);
    expect(trait(result, "half_time_share")?.valueNumber).toBeCloseTo(33.3, 0);
    expect(trait(result, "half_time_share")?.sourceCount).toBe(3);
  });

  it("leaves the promise out when no prompt states a tempo", () => {
    const result = buildDnaProfile([makeTrack(), makeTrack({ prompt: "ambient, no numbers" })], { now });

    expect(trait(result, "tempo_intent")).toBeNull();
    expect(trait(result, "half_time_share")).toBeNull();
  });

  it("names the engine you generate with, merges PoYo into Suno and skips uploads", () => {
    const result = buildDnaProfile(
      [
        makeTrack({ provider: "poyo" }),
        makeTrack({ provider: "suno" }),
        makeTrack({ provider: "apimart" }),
        makeTrack({ provider: "upload" }),
      ],
      { now },
    );

    const engine = trait(result, "preferred_engine");
    expect(engine?.category).toBe("sound");
    expect(JSON.parse(engine!.valueText!)).toEqual(["Suno", "APIMart"]);
    expect(engine?.display).toBe("Suno, APIMart");
    // The upload has no engine, so it is not evidence either way.
    expect(engine?.sourceCount).toBe(3);
  });

  it("reports a finished clone as the own-voice trait", () => {
    const result = buildDnaProfile([makeTrack()], {
      now,
      voice: { voiceCount: 2, selectedName: "Nova" },
    });

    const own = trait(result, "own_voice");
    expect(own?.category).toBe("voice");
    expect(own?.display).toBe("Nova");
    expect(own?.sourceCount).toBe(2);
  });

  it("leaves own voice out when no clone ever finished", () => {
    const result = buildDnaProfile([makeTrack()], { now, voice: null });

    expect(trait(result, "own_voice")).toBeNull();
  });

  it("measures own voice as a share of the tracks that recorded an answer", () => {
    const result = buildDnaProfile(
      [
        makeTrack({ ownVoice: true }),
        makeTrack({ ownVoice: false }),
        makeTrack({ ownVoice: null }),
        makeTrack({ ownVoice: true }),
      ],
      { now, voice: { voiceCount: 1, selectedName: "Nova" } },
    );

    const own = trait(result, "own_voice");
    expect(own?.kind).toBe("ratio");
    expect(own?.valueNumber).toBeCloseTo(66.7, 1);
    expect(own?.sourceCount).toBe(3);
    expect(own?.display).toBe("67% with your cloned voice");
  });

  it("reports a spectrum only once three tracks name one of its poles", () => {
    const prompts = ["rap, trap", "rap, boom bap", "hip hop, drill"];
    const two = buildDnaProfile(
      prompts.slice(0, 2).map((prompt) => makeTrack({ prompt })),
      { now },
    );
    const three = buildDnaProfile(
      prompts.map((prompt) => makeTrack({ prompt })),
      { now },
    );

    expect(trait(two, "rap_melodic")).toBeNull();

    const spectrum = trait(three, "rap_melodic");
    expect(spectrum?.category).toBe("sound");
    expect(spectrum?.valueNumber).toBe(0);
    expect(spectrum?.display).toBe("0% rap");
    expect(spectrum?.sourceCount).toBe(3);
  });

  it("describes the dominant energy arc", () => {
    const building = [10, 18, 26, 34, 42, 50, 58, 66, 74, 82];
    const result = buildDnaProfile(
      [makeTrack(), makeTrack(), makeTrack()].map((track) => ({
        ...track,
        audioDna: { ...track.audioDna!, energyArc: building },
      })),
      { now },
    );

    const arc = trait(result, "energy_arc");
    expect(arc?.category).toBe("sound");
    expect(arc?.valueText).toBe("Builds");
    expect(arc?.display).toBe("Builds 100%");
  });

  it("measures the hook-before-30 share over the tracks that could be judged", () => {
    const result = buildDnaProfile(
      [
        makeTrack({ audioDna: { ...makeTrack().audioDna!, hookEarly: true } }),
        makeTrack({ audioDna: { ...makeTrack().audioDna!, hookEarly: true } }),
        makeTrack({ audioDna: { ...makeTrack().audioDna!, hookEarly: false } }),
        // Analysed before the arc existed: no answer, so not part of the share.
        makeTrack(),
      ],
      { now },
    );

    const hook = trait(result, "hook_before_30");
    expect(hook?.category).toBe("structure");
    expect(hook?.valueNumber).toBeCloseTo(66.7, 1);
    expect(hook?.sourceCount).toBe(3);
    expect(hook?.display).toBe("67% hook in the first 30s");
  });

  it("reads signature instruments from the prompts", () => {
    const result = buildDnaProfile(
      ["upright piano, brushed drums, warm strings", "piano and strings", "solo piano"].map((prompt) =>
        makeTrack({ prompt }),
      ),
      { now },
    );

    const instruments = trait(result, "signature_instruments");
    expect(instruments?.category).toBe("sound");
    expect(instruments?.kind).toBe("list");
    expect(instruments?.sourceCount).toBe(3);
    expect(JSON.parse(instruments!.valueText!)).toEqual(["Piano", "Strings", "Drums"]);
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
