import { describe, expect, it } from "vitest";

import { detectTempo } from "../tempo";

const SAMPLE_RATE = 22050;

/** Deterministic pseudo-noise so the click timbre is identical on every run. */
function makeNoise(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return (state / 4294967296) * 2 - 1;
  };
}

/** Kick-like clicks on the beat: a short noise burst plus a 60 Hz thump. */
function clickTrack(bpm: number, seconds = 12): Float32Array {
  const noise = makeNoise(42);
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  const period = 60 / bpm;

  for (let beat = 0; beat * period < seconds; beat++) {
    const start = Math.floor(beat * period * SAMPLE_RATE);
    const clickLength = Math.floor(SAMPLE_RATE * 0.008);
    for (let i = 0; i < clickLength; i++) {
      const index = start + i;
      if (index >= samples.length) break;
      const envelope = Math.exp(-i / (SAMPLE_RATE * 0.002));
      const thump = Math.sin((2 * Math.PI * 60 * i) / SAMPLE_RATE);
      samples[index] += (noise() * 0.6 + thump * 0.8) * envelope;
    }
  }

  return samples;
}

describe("detectTempo", () => {
  // The library assumes 44.1 kHz. Before the hop duration was corrected, every
  // track below ~100 BPM came back at double tempo (85 was measured as 170).
  it.each([70, 85, 100, 120, 141])("reads a %i BPM click track without doubling it", (bpm) => {
    expect(detectTempo(clickTrack(bpm), SAMPLE_RATE)).toBeCloseTo(bpm, 0);
  });
});
