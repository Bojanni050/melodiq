import { describe, expect, it } from "vitest";

import { buildDnaProfile } from "../dna/aggregate";
import { parseHabit } from "../dna/habits";
import type { DnaHabitProfile, DnaSourceTrack } from "../dna/types";

let idCounter = 0;

function makeTrack(overrides: Partial<DnaSourceTrack> = {}): DnaSourceTrack {
  idCounter += 1;
  return {
    id: `habit-track-${idCounter}`,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    duration: 200,
    prompt: "pop",
    provider: "suno",
    lyrics: "one line",
    language: "en",
    instrumental: false,
    ownVoice: null,
    voiceId: null,
    vocalGender: "female",
    rating: null,
    playCount: 0,
    archivedAt: null,
    hiddenAt: null,
    audioDna: null,
    advancedDna: null,
    ...overrides,
  };
}

const now = new Date("2026-06-01T00:00:00Z");

function trait(result: ReturnType<typeof buildDnaProfile>, key: string) {
  return result.traits.find((entry) => entry.key === key) ?? null;
}

function habits(overrides: Partial<DnaHabitProfile> = {}): DnaHabitProfile {
  return {
    events: [],
    publicTracks: 0,
    totalTracks: 0,
    ...overrides,
  };
}

describe("parseHabit", () => {
  it("accepts a complete snapshot", () => {
    expect(parseHabit({ origin: "preset", mode: "advanced", edited: true })).toEqual({
      origin: "preset",
      mode: "advanced",
      edited: true,
    });
  });

  it("fills defaults for a partially sent snapshot", () => {
    // An older client that only knows where the prompt came from still logs.
    expect(parseHabit({ origin: "reuse" })).toEqual({
      origin: "reuse",
      mode: "simple",
      edited: false,
    });
  });

  it("rejects an unknown origin instead of inventing one", () => {
    expect(parseHabit({ origin: "telepathy", mode: "simple", edited: false })).toBeNull();
    expect(parseHabit({})).toBeNull();
    expect(parseHabit(null)).toBeNull();
    expect(parseHabit("reuse")).toBeNull();
  });

  it("ignores a non-boolean edited flag", () => {
    expect(parseHabit({ origin: "scratch", mode: "simple", edited: "yes" })?.edited).toBe(false);
  });
});

describe("habit traits", () => {
  it("reports how songs start, from one event per generation", () => {
    const result = buildDnaProfile([makeTrack()], {
      now,
      habits: habits({
        events: [
          { origin: "reuse", mode: "advanced", edited: false },
          { origin: "reuse", mode: "advanced", edited: false },
          { origin: "saved_lyrics", mode: "simple", edited: true },
        ],
      }),
    });

    const origin = trait(result, "how_you_start");
    expect(origin?.category).toBe("habits");
    expect(origin?.valueText).toBe("Reused prompt");
    expect(origin?.display).toBe("Reused prompt 67%");
    expect(origin?.sourceCount).toBe(3);

    const mode = trait(result, "simple_or_advanced");
    expect(mode?.valueText).toBe("Advanced");
    expect(mode?.display).toBe("Advanced 67%");

    const edited = trait(result, "edits_before_generate");
    expect(edited?.kind).toBe("ratio");
    expect(edited?.valueNumber).toBeCloseTo(33.3, 1);
    expect(edited?.display).toBe("33% of prompts edited before generating");
    expect(edited?.sourceCount).toBe(3);
  });

  it("counts the public share over finished tracks, not events", () => {
    const result = buildDnaProfile([makeTrack()], {
      now,
      habits: habits({ publicTracks: 2, totalTracks: 10 }),
    });

    const publicTrait = trait(result, "public_by_default");
    expect(publicTrait?.kind).toBe("ratio");
    expect(publicTrait?.valueNumber).toBe(20);
    expect(publicTrait?.display).toBe("20% of your tracks are public");
    // Every track had a chance to answer, so the caption counts tracks.
    expect(publicTrait?.sourceCount).toBe(10);
    // No generation was recorded, so there is nothing to say about starting.
    expect(trait(result, "how_you_start")).toBeNull();
  });

  it("omits the whole category when no habits exist", () => {
    const result = buildDnaProfile([makeTrack()], { now });
    expect(result.traits.some((entry) => entry.category === "habits")).toBe(false);
  });

  it("keeps the habits category last", () => {
    const result = buildDnaProfile([makeTrack()], {
      now,
      habits: habits({
        events: [{ origin: "scratch", mode: "simple", edited: false }],
        publicTracks: 1,
        totalTracks: 1,
      }),
    });

    const last = result.traits[result.traits.length - 1];
    expect(last.category).toBe("habits");
    expect(last.key).toBe("public_by_default");
  });
});
