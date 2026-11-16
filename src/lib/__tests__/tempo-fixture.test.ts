import { describe, expect, it } from "vitest";

import { chooseBeatLevel, toBeatAgents, type BeatAgent } from "../tempo";

import cases from "./fixtures/tempo-agents.json";

/**
 * Agent tables captured from production audio, so tuning `chooseBeatLevel` can
 * be measured instead of guessed.
 *
 * The tables keep the library's own fields (`beatInterval`, `score`, events
 * count) rather than a derived per-beat figure. An earlier version stored
 * `perBeat` rounded to two decimals, which quietly moved a case across the
 * 1.2x threshold: 3.88 against 3.88 looked like a win, while the real numbers
 * (3.8765 against 3.8814) are a loss. Rounding in a fixture turns a boundary
 * case into a false pass, so the test now runs the captured data through the
 * same mapping the runtime uses.
 *
 * Three shapes are represented:
 * - `aligned`: prompt and pulse agree, which is the boring majority.
 * - `half`: half-time, trap and 808 material where the prompt names the grid
 *   (120) and the ear hears the pulse (60).
 * - `double` (labelled `waltz` in the fixture): a 3/4 read on its eighth notes.
 *
 * Captured with `new MusicTempo(pcm, { timeStep: 441 / 22050 })` on the full
 * track, exactly like `detectTempo` does at runtime.
 */
interface FixtureCase {
  id: string;
  title: string;
  promptBpm: number;
  pulse: number;
  relation: string;
  knownLimitation?: string;
  /** `events` is a count here; the library exposes the onsets themselves. */
  agents: { beatInterval: number; score: number; events: number }[];
}

const CASES = cases as FixtureCase[];
const TOLERANCE_BPM = 4;

function chosen(testCase: FixtureCase): BeatAgent {
  // `toBeatAgents` reads `events.length`, so the stored count becomes a
  // placeholder array of that length. Storing nine full onset lists would
  // multiply the fixture size for data nothing reads.
  const agent = chooseBeatLevel(
    toBeatAgents({
      agents: testCase.agents.map((agent) => ({
        beatInterval: agent.beatInterval,
        score: agent.score,
        events: new Array(agent.events).fill(0),
      })),
    }),
  );
  expect(agent, `${testCase.title}: no beat grid chosen`).not.toBeNull();
  return agent as BeatAgent;
}

function describeMiss(testCase: FixtureCase): string {
  return `${testCase.title} (${testCase.relation}, prompt ${testCase.promptBpm}): expected ~${testCase.pulse}, got ${chosen(testCase).bpm.toFixed(1)}`;
}

describe("chooseBeatLevel on measured agent tables", () => {
  it("reports the pulse the listener would tap", () => {
    for (const testCase of CASES.filter((item) => !item.knownLimitation)) {
      expect(Math.abs(chosen(testCase).bpm - testCase.pulse), describeMiss(testCase)).toBeLessThanOrEqual(
        TOLERANCE_BPM,
      );
    }
  });

  // The three 3/4 tracks. Each fails for its own documented reason, and none of
  // them is fixed by moving a threshold: one has no slower agent at all, one
  // loses by 0.13%, and one has a candidate just outside the octave tolerance.
  // They stay marked as failures on purpose — when a fix lands, this test starts
  // failing and the case moves out of `knownLimitation`.
  it.fails("reaches the pulse on a 3/4 read on its eighth notes", () => {
    for (const testCase of CASES.filter((item) => item.knownLimitation)) {
      expect(Math.abs(chosen(testCase).bpm - testCase.pulse), describeMiss(testCase)).toBeLessThanOrEqual(
        TOLERANCE_BPM,
      );
    }
  });

  it("keeps the half-time cases well below their promised grid", () => {
    for (const testCase of CASES.filter((item) => item.relation === "half")) {
      expect(chosen(testCase).bpm).toBeLessThan(testCase.promptBpm * 0.75);
    }
  });
});
