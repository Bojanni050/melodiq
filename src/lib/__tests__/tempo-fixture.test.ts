import { describe, expect, it } from "vitest";

import { chooseBeatLevel, type BeatAgent } from "../tempo";

import cases from "./fixtures/tempo-agents.json";

/**
 * Agent tables captured from production audio, so tuning `chooseBeatLevel` can
 * be measured instead of guessed. Each case carries the beat tracker's full
 * agent list (frequencies, scores per beat), the tempo its prompt promises and
 * the pulse a listener would tap.
 *
 * Three shapes are represented:
 * - `aligned`: prompt and pulse agree, which is the boring majority.
 * - `half`: half-time, trap and 808 material where the prompt names the grid
 *   (120) and the ear hears the pulse (60).
 * - `waltz`: a 3/4 at 58 the beat tracker reads on its eighth notes (113), with
 *   no slower agent anywhere near the pulse.
 *
 * Captured with `new MusicTempo(pcm, { timeStep: 441 / 22050 })` on the full
 * track, filtered to 40-220 BPM, exactly like `detectTempo` does at runtime.
 */
interface FixtureCase {
  id: string;
  title: string;
  promptBpm: number;
  pulse: number;
  relation: string;
  knownLimitation: boolean;
  agents: BeatAgent[];
}

const CASES = cases as FixtureCase[];
const TOLERANCE_BPM = 4;

function chosen(testCase: FixtureCase): BeatAgent {
  const agent = chooseBeatLevel(testCase.agents);
  expect(agent, `${testCase.title}: no beat grid chosen`).not.toBeNull();
  return agent as BeatAgent;
}

describe("chooseBeatLevel on measured agent tables", () => {
  it("reports the pulse the listener would tap", () => {
    for (const testCase of CASES.filter((item) => !item.knownLimitation)) {
      expect(
        Math.abs(chosen(testCase).bpm - testCase.pulse),
        `${testCase.title} (${testCase.relation}, prompt ${testCase.promptBpm}): expected ~${testCase.pulse}, got ${chosen(testCase).bpm.toFixed(1)}`,
      ).toBeLessThanOrEqual(TOLERANCE_BPM);
    }
  });

  // A waltz whose eighth notes are the fastest grid the tracker proposes: the
  // agent list simply has no candidate near 58, so no rule inside this function
  // can find it. These stay marked as failures on purpose — when a fix lands,
  // this test starts failing and the case moves out of `knownLimitation`.
  it.fails("reaches the pulse on a 3/4 read on its eighth notes", () => {
    for (const testCase of CASES.filter((item) => item.knownLimitation)) {
      expect(
        Math.abs(chosen(testCase).bpm - testCase.pulse),
        `${testCase.title}: expected ~${testCase.pulse}, got ${chosen(testCase).bpm.toFixed(1)}`,
      ).toBeLessThanOrEqual(TOLERANCE_BPM);
    }
  });

  it("keeps the half-time cases well below their promised grid", () => {
    for (const testCase of CASES.filter((item) => item.relation === "half")) {
      expect(chosen(testCase).bpm).toBeLessThan(testCase.promptBpm * 0.75);
    }
  });
});
