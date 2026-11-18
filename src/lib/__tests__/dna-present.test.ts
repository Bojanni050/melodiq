import { describe, expect, it } from "vitest";
import { serialiseDnaProfile } from "@/lib/dna/present";
import type { StoredDnaProfile } from "@/lib/dna/repository";

const NOW = new Date("2026-11-18T12:00:00Z");
const RECENT = new Date("2026-11-16T12:00:00Z");
const LONG_AGO = new Date("2026-08-01T12:00:00Z");

type TraitOverrides = Partial<StoredDnaProfile["traits"][number]> & { traitKey: string };

function trait(overrides: TraitOverrides): StoredDnaProfile["traits"][number] {
  return {
    id: `id-${overrides.traitKey}`,
    profileId: "profile-1",
    userId: "user-1",
    category: "words",
    label: "Rhyme density",
    kind: "ratio",
    valueNumber: 46,
    valueText: null,
    unit: "%",
    display: "46% of lines rhyme",
    confidence: 0.9,
    sourceCount: 100,
    weight: 100,
    firstSeenAt: LONG_AGO,
    lastChangedAt: LONG_AGO,
    lockedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function profile(input: {
  traits?: StoredDnaProfile["traits"];
  history?: StoredDnaProfile["history"];
}): StoredDnaProfile {
  return {
    profile: {
      id: "profile-1",
      userId: "user-1",
      name: "Midtempo cinematic pop",
      summary: null,
      sourceCount: 1200,
      ratedCount: 96,
      likedCount: 96,
      dislikedCount: 0,
      computedAt: NOW,
      createdAt: LONG_AGO,
      updatedAt: NOW,
    },
    traits: input.traits ?? [],
    feedback: new Map(),
    history: input.history ?? [],
    signals: { songs: 1200, edits: 3, calibrations: 2, label: "1200 songs · 3 edits · 2 calibrations" },
  };
}

function change(traitKey: string, direction: string, changedAt: Date): StoredDnaProfile["history"][number] {
  return {
    id: `h-${traitKey}-${direction}-${changedAt.getTime()}`,
    profileId: "profile-1",
    userId: "user-1",
    traitKey,
    category: "words",
    previousDisplay: "40% of lines rhyme",
    display: "46% of lines rhyme",
    previousNumber: 40,
    valueNumber: 46,
    direction,
    changedAt,
  };
}

describe("serialiseDnaProfile", () => {
  it("keeps the empty shape usable for a user without a profile", () => {
    const payload = serialiseDnaProfile(null, { now: NOW });
    expect(payload.profile).toBeNull();
    expect(payload.traits).toEqual([]);
    expect(payload.changes).toEqual([]);
    expect(payload.signals.songs).toBe(0);
  });

  it("marks a trait that changed this week as pulsing", () => {
    const payload = serialiseDnaProfile(
      profile({ traits: [trait({ traitKey: "rhyme_density", lastChangedAt: RECENT })] }),
      { now: NOW },
    );
    expect(payload.traits[0].state).toBe("pulsing");
    expect(payload.traits[0].pulsing).toBe(true);
  });

  it("lets a lock outrank a recent change", () => {
    const payload = serialiseDnaProfile(
      profile({ traits: [trait({ traitKey: "tempo", lastChangedAt: RECENT, lockedAt: RECENT })] }),
      { now: NOW },
    );
    expect(payload.traits[0].state).toBe("locked");
    expect(payload.traits[0].pulsing).toBe(false);
    expect(payload.traits[0].lockedAt).toBe(RECENT.toISOString());
  });

  it("calls an old, confident trait sure and an old, weak one learning", () => {
    const payload = serialiseDnaProfile(
      profile({
        traits: [
          trait({ traitKey: "rhyme_density", lastChangedAt: LONG_AGO, confidence: 0.9 }),
          trait({ traitKey: "internal_rhyme", lastChangedAt: LONG_AGO, confidence: 0.2 }),
        ],
      }),
      { now: NOW },
    );
    expect(payload.traits.map((entry) => entry.state)).toEqual(["sure", "learning"]);
  });

  it("reads the trend from the newest changes of that trait only", () => {
    const payload = serialiseDnaProfile(
      profile({
        traits: [trait({ traitKey: "rhyme_density", lastChangedAt: LONG_AGO })],
        history: [
          change("rhyme_density", "up", RECENT),
          change("rhyme_density", "down", RECENT),
          change("internal_rhyme", "down", RECENT),
        ],
      }),
      { now: NOW },
    );
    expect(payload.traits[0].trend).toBe("steady");
    expect(payload.changes).toHaveLength(3);
  });

  it("passes the counters through untouched", () => {
    const payload = serialiseDnaProfile(profile({}), { now: NOW });
    expect(payload.signals.label).toBe("1200 songs · 3 edits · 2 calibrations");
  });
});
