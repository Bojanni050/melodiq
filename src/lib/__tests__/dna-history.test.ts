import { describe, expect, it } from "vitest";
import { applyLocks, diffTraits, stampTimeline, type TraitSnapshot } from "@/lib/dna/history";

const NOW = new Date("2026-11-18T12:00:00Z");
const OLD = new Date("2026-09-01T12:00:00Z");

function trait(overrides: Partial<TraitSnapshot> & Pick<TraitSnapshot, "traitKey">): TraitSnapshot {
  return {
    category: "words",
    kind: "ratio",
    valueNumber: 40,
    valueText: null,
    display: "40% of lines rhyme",
    confidence: 0.8,
    sourceCount: 100,
    weight: 100,
    firstSeenAt: OLD,
    lastChangedAt: OLD,
    lockedAt: null,
    ...overrides,
  };
}

describe("diffTraits", () => {
  it("ignores a rebuild that reproduces the same values", () => {
    const previous = [trait({ traitKey: "rhyme_density" })];
    expect(diffTraits(previous, [trait({ traitKey: "rhyme_density" })])).toEqual([]);
  });

  it("records one change with direction up when the number rises", () => {
    const previous = [trait({ traitKey: "rhyme_density", valueNumber: 40, display: "40% of lines rhyme" })];
    const next = [trait({ traitKey: "rhyme_density", valueNumber: 46, display: "46% of lines rhyme" })];
    expect(diffTraits(previous, next)).toEqual([
      {
        traitKey: "rhyme_density",
        category: "words",
        previousDisplay: "40% of lines rhyme",
        display: "46% of lines rhyme",
        previousNumber: 40,
        valueNumber: 46,
        direction: "up",
      },
    ]);
  });

  it("records direction down when the number falls", () => {
    const previous = [trait({ traitKey: "tempo", category: "sound", valueNumber: 90 })];
    const next = [trait({ traitKey: "tempo", category: "sound", valueNumber: 85 })];
    expect(diffTraits(previous, next)[0]).toMatchObject({ traitKey: "tempo", direction: "down" });
  });

  it("marks a text trait as changed rather than inventing a direction", () => {
    const previous = [trait({ traitKey: "pov", kind: "text", valueNumber: 50, valueText: "first" })];
    const next = [trait({ traitKey: "pov", kind: "text", valueNumber: 60, valueText: "mixed" })];
    expect(diffTraits(previous, next)[0]).toMatchObject({ traitKey: "pov", direction: "changed" });
  });

  it("writes nothing for a trait that is new or that disappeared", () => {
    const previous = [trait({ traitKey: "tempo" })];
    const next = [trait({ traitKey: "rhyme_density" })];
    expect(diffTraits(previous, next)).toEqual([]);
  });

  it("does not treat a confidence-only shift as a value change", () => {
    const previous = [trait({ traitKey: "tempo", confidence: 0.4 })];
    const next = [trait({ traitKey: "tempo", confidence: 0.9 })];
    expect(diffTraits(previous, next)).toEqual([]);
  });
});

describe("applyLocks", () => {
  it("keeps the pinned value and its timestamp", () => {
    const previous = [
      trait({ traitKey: "tempo", valueNumber: 85, display: "85 BPM", lockedAt: OLD }),
    ];
    const next = [trait({ traitKey: "tempo", valueNumber: 120, display: "120 BPM" })];
    const merged = applyLocks(previous, next);
    expect(merged).toHaveLength(1);
    expect(merged[0].valueNumber).toBe(85);
    expect(merged[0].display).toBe("85 BPM");
    expect(merged[0].lockedAt).toEqual(OLD);
  });

  it("keeps a pinned trait the catalogue no longer produces", () => {
    const previous = [trait({ traitKey: "half_time_share", lockedAt: OLD })];
    const merged = applyLocks(previous, [trait({ traitKey: "tempo" })]);
    expect(merged.map((item) => item.traitKey).sort()).toEqual(["half_time_share", "tempo"]);
  });

  it("passes unlocked traits through untouched", () => {
    const previous = [trait({ traitKey: "tempo", valueNumber: 85 })];
    const next = [trait({ traitKey: "tempo", valueNumber: 120 })];
    expect(applyLocks(previous, next)[0].valueNumber).toBe(120);
  });
});

describe("stampTimeline", () => {
  it("moves lastChangedAt only when the value really moved", () => {
    const previous = [trait({ traitKey: "tempo", valueNumber: 85 })];
    const same = stampTimeline(previous, [trait({ traitKey: "tempo", valueNumber: 85 })], { now: NOW });
    expect(same[0].lastChangedAt).toEqual(OLD);

    const moved = stampTimeline(previous, [trait({ traitKey: "tempo", valueNumber: 88 })], { now: NOW });
    expect(moved[0].lastChangedAt).toEqual(NOW);
    expect(moved[0].firstSeenAt).toEqual(OLD);
  });

  it("stamps both timestamps for a brand-new trait", () => {
    const stamped = stampTimeline([], [trait({ traitKey: "rhyme_density" })], { now: NOW });
    expect(stamped[0].firstSeenAt).toEqual(NOW);
    expect(stamped[0].lastChangedAt).toEqual(NOW);
  });
});
