import { describe, expect, it } from "vitest";

import {
  calibrationCardText,
  calibrationPairKey,
  feedbackKindForChoice,
  pickCalibrationPair,
  sortPairIds,
  type CalibrationCandidate,
} from "@/lib/dna/calibration";

function track(id: string, tempo: number | null, energy: number | null = null): CalibrationCandidate {
  return { id, title: `Track ${id}`, prompt: null, audioUrl: `/a/${id}.mp3`, duration: 120, tempo, energy };
}

const BOTH = new Set(["tempo", "energy"]);

describe("pickCalibrationPair", () => {
  it("returns null without enough contrast", () => {
    const pair = pickCalibrationPair({
      candidates: [track("a", 100), track("b", 110)],
      availableTraitKeys: BOTH,
      answered: [],
    });
    expect(pair).toBeNull();
  });

  it("returns null when the profile has no duel-able trait", () => {
    const pair = pickCalibrationPair({
      candidates: [track("a", 70), track("b", 130)],
      availableTraitKeys: new Set(["genres"]),
      answered: [],
    });
    expect(pair).toBeNull();
  });

  it("picks two tracks that differ enough on the trait", () => {
    const pair = pickCalibrationPair({
      candidates: [track("a", 70), track("b", 130)],
      availableTraitKeys: BOTH,
      answered: [],
    });
    expect(pair?.traitKey).toBe("tempo");
    expect(Math.abs((pair?.leftValue ?? 0) - (pair?.rightValue ?? 0))).toBeGreaterThanOrEqual(20);
  });

  it("never repeats an answered pair, whichever way round it was stored", () => {
    const candidates = [track("a", 70), track("b", 130)];
    const pair = pickCalibrationPair({
      candidates,
      availableTraitKeys: new Set(["tempo"]),
      answered: [{ traitKey: "tempo", trackAId: "b", trackBId: "a" }],
    });
    expect(pair).toBeNull();
  });

  it("prefers tracks that were used least", () => {
    const candidates = [track("a", 60), track("b", 140), track("c", 100), track("d", 150)];
    const pair = pickCalibrationPair({
      candidates,
      availableTraitKeys: new Set(["tempo"]),
      answered: [{ traitKey: "tempo", trackAId: "a", trackBId: "b" }],
    });
    const ids = [pair?.left.id, pair?.right.id];
    expect(ids).not.toContain("a");
    expect(ids).not.toContain("b");
  });

  it("alternates traits with the answer count", () => {
    const candidates = [track("a", 60, 20), track("b", 140, 90), track("c", 100, 50)];
    const first = pickCalibrationPair({ candidates, availableTraitKeys: BOTH, answered: [] });
    const second = pickCalibrationPair({
      candidates,
      availableTraitKeys: BOTH,
      answered: [{ traitKey: "tempo", trackAId: "a", trackBId: "b" }],
    });
    expect(first?.traitKey).toBe("tempo");
    expect(second?.traitKey).toBe("energy");
  });

  it("falls back to the other trait when one is exhausted", () => {
    const candidates = [track("a", 100, 10), track("b", 105, 90)];
    const pair = pickCalibrationPair({ candidates, availableTraitKeys: BOTH, answered: [] });
    expect(pair?.traitKey).toBe("energy");
  });

  it("flips which side the faster track lands on", () => {
    const candidates = [track("a", 60), track("b", 140), track("c", 61), track("d", 141)];
    const even = pickCalibrationPair({ candidates, availableTraitKeys: new Set(["tempo"]), answered: [] });
    const odd = pickCalibrationPair({
      candidates,
      availableTraitKeys: new Set(["tempo"]),
      answered: [{ traitKey: "tempo", trackAId: "x", trackBId: "y" }],
    });
    expect((even?.leftValue ?? 0) < (even?.rightValue ?? 0)).toBe(true);
    expect((odd?.leftValue ?? 0) > (odd?.rightValue ?? 0)).toBe(true);
  });
});

describe("released tracks first", () => {
  const released = (id: string, tempo: number): CalibrationCandidate => ({ ...track(id, tempo), released: true });

  it("prefers a pair of released tracks over a wider unreleased pair", () => {
    const pair = pickCalibrationPair({
      candidates: [track("x", 50), track("y", 180), released("a", 80), released("b", 110)],
      availableTraitKeys: new Set(["tempo"]),
      answered: [],
    });
    expect([pair?.left.id, pair?.right.id].sort()).toEqual(["a", "b"]);
  });

  it("prefers one released track over none", () => {
    const pair = pickCalibrationPair({
      candidates: [track("x", 50), track("y", 180), released("a", 100)],
      availableTraitKeys: new Set(["tempo"]),
      answered: [],
    });
    const ids = [pair?.left.id, pair?.right.id];
    expect(ids).toContain("a");
  });

  it("falls back to unreleased tracks once released pairs are used up", () => {
    const pair = pickCalibrationPair({
      candidates: [track("x", 50), track("y", 180), released("a", 80), released("b", 110)],
      availableTraitKeys: new Set(["tempo"]),
      answered: [{ traitKey: "tempo", trackAId: "a", trackBId: "b" }],
    });
    expect(pair).not.toBeNull();
  });

  it("looks across traits for released tracks before rotating", () => {
    const candidates = [
      { ...track("a", 100, 10), released: true },
      { ...track("b", 105, 90), released: true },
      track("c", 60, 50),
      track("d", 160, 50),
    ];
    const pair = pickCalibrationPair({ candidates, availableTraitKeys: BOTH, answered: [] });
    expect(pair?.traitKey).toBe("energy");
    expect([pair?.left.id, pair?.right.id].sort()).toEqual(["a", "b"]);
  });
});

describe("feedbackKindForChoice", () => {
  const pair = {
    traitKey: "tempo",
    left: track("a", 72),
    right: track("b", 129),
    leftValue: 72,
    rightValue: 129,
  };

  it("maps the faster pick to more and the slower pick to less", () => {
    expect(feedbackKindForChoice(pair, "right")).toBe("more");
    expect(feedbackKindForChoice(pair, "left")).toBe("less");
  });

  it("maps neither to reject", () => {
    expect(feedbackKindForChoice(pair, "neither")).toBe("reject");
  });
});

describe("pair ids and card text", () => {
  it("treats a pair as order independent", () => {
    expect(calibrationPairKey("tempo", "b", "a")).toBe(calibrationPairKey("tempo", "a", "b"));
    expect(sortPairIds("b", "a")).toEqual(["a", "b"]);
  });

  it("cuts long prompts with an ellipsis and keeps only the first line", () => {
    const text = calibrationCardText({ title: null, prompt: `${"word ".repeat(40)}\nsecond line` }, 30);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(30);
    expect(text).not.toContain("second");
  });

  it("prefers the title over the prompt", () => {
    expect(calibrationCardText({ title: "Light On", prompt: "long prompt" })).toBe("Light On");
  });
});
