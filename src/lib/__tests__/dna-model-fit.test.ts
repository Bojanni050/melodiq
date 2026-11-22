import { describe, expect, it } from "vitest";
import {
  dnaFitTargets,
  rankDnaModelCandidates,
  scoreDnaFit,
  type DnaFitTargets,
  type DnaFitTrackInput,
} from "@/lib/dna/model-fit";

function track(overrides: Partial<DnaFitTrackInput> & { id: string }): DnaFitTrackInput {
  return {
    title: `Track ${overrides.id}`,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    rating: null,
    instrumental: false,
    prompt: "",
    audioDna: null,
    ...overrides,
  };
}

const targets: DnaFitTargets = {
  tempo: 120,
  energy: 60,
  genres: ["synthwave"],
  atmospheres: ["dreamy"],
};

describe("dnaFitTargets", () => {
  it("reads numbers and list traits from the profile", () => {
    const result = dnaFitTargets([
      { traitKey: "tempo", valueNumber: 118, valueText: null },
      { traitKey: "energy", valueNumber: 57, valueText: null },
      { traitKey: "genres", valueNumber: null, valueText: JSON.stringify(["synthwave", "pop"]) },
      { traitKey: "atmospheres", valueNumber: null, valueText: "dreamy, warm" },
    ]);

    expect(result).toEqual({
      tempo: 118,
      energy: 57,
      genres: ["synthwave", "pop"],
      atmospheres: ["dreamy", "warm"],
    });
  });

  it("keeps at most three of each list and tolerates missing traits", () => {
    const result = dnaFitTargets([
      { traitKey: "genres", valueNumber: null, valueText: JSON.stringify(["a", "b", "c", "d"]) },
    ]);

    expect(result.genres).toEqual(["a", "b", "c"]);
    expect(result.tempo).toBeNull();
    expect(result.atmospheres).toEqual([]);
  });

  it("returns nulls and empty lists for an empty profile", () => {
    expect(dnaFitTargets([])).toEqual({ tempo: null, energy: null, genres: [], atmospheres: [] });
  });
});

describe("scoreDnaFit", () => {
  it("scores a track that matches every target highly", () => {
    const { score, reasons } = scoreDnaFit(
      track({
        id: "close",
        prompt: "dreamy synthwave",
        audioDna: JSON.stringify({ tempo: 120, energy: 60, atmosphereTags: ["dreamy"] }),
        rating: "up",
      }),
      targets
    );

    expect(score).toBe(100);
    expect(reasons).toEqual(["120 BPM", "energy 60", "dreamy", "synthwave", "rated up"]);
  });

  it("scores a track that matches nothing at zero", () => {
    const { score } = scoreDnaFit(
      track({
        id: "far",
        prompt: "acoustic folk",
        audioDna: JSON.stringify({ tempo: 76, energy: 10, atmosphereTags: ["intimate"] }),
        rating: "down",
      }),
      targets
    );

    expect(score).toBe(0);
  });

  it("ignores dimensions the track has no data for instead of punishing them", () => {
    // Only tempo is comparable: 120 vs 120 → 1.0, so the score is 100 rather
    // than being dragged down by the missing energy/atmosphere/genre.
    const { score, reasons } = scoreDnaFit(
      track({ id: "tempo-only", audioDna: JSON.stringify({ tempo: 120 }) }),
      targets
    );

    expect(score).toBe(100);
    expect(reasons).toEqual(["120 BPM"]);
  });

  it("returns a null score when nothing can be compared", () => {
    const { score, reasons } = scoreDnaFit(track({ id: "unknown" }), targets);

    expect(score).toBeNull();
    expect(reasons).toEqual([]);
  });

  it("survives an unreadable audio DNA blob", () => {
    const { score } = scoreDnaFit(track({ id: "broken", audioDna: "{not json" }), targets);

    expect(score).toBeNull();
  });
});

describe("rankDnaModelCandidates", () => {
  it("puts the best fit first and uncomparable tracks last", () => {
    const ranked = rankDnaModelCandidates(
      [
        track({ id: "unknown", createdAt: new Date("2026-05-01T00:00:00Z") }),
        track({ id: "far", audioDna: JSON.stringify({ tempo: 76, energy: 10 }), createdAt: new Date("2026-04-01T00:00:00Z") }),
        track({ id: "near", audioDna: JSON.stringify({ tempo: 118, energy: 58 }), createdAt: new Date("2026-03-01T00:00:00Z") }),
      ],
      targets
    );

    expect(ranked.map((candidate) => candidate.id)).toEqual(["near", "far", "unknown"]);
    expect(ranked[2].score).toBeNull();
  });

  it("breaks ties by newest first", () => {
    const ranked = rankDnaModelCandidates(
      [
        track({ id: "older", audioDna: JSON.stringify({ tempo: 120 }), createdAt: new Date("2026-01-01T00:00:00Z") }),
        track({ id: "newer", audioDna: JSON.stringify({ tempo: 120 }), createdAt: new Date("2026-02-01T00:00:00Z") }),
      ],
      targets
    );

    expect(ranked.map((candidate) => candidate.id)).toEqual(["newer", "older"]);
  });
});
