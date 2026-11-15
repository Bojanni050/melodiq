import MusicTempo from "music-tempo";

/**
 * Detect BPM from mono PCM.
 *
 * Two separate corrections live here, both about the same octave problem.
 *
 * 1. Hop duration. music-tempo's internals assume 44.1 kHz: it cuts the signal
 *    in 441-sample hops and labels each hop 10 ms (`timeStep`). Decode at
 *    anything else and every inter-onset interval is read at the wrong length.
 *
 * 2. Beat level. The library picks the beat-tracking agent with the highest
 *    accumulated score, and an agent earns score for every beat it places. A
 *    grid at double time therefore collects roughly twice as much score as the
 *    grid one octave down, and nothing in the library pushes back: it has a
 *    `penaltyFactor` for sloppy timing but no tempo prior. Measured against 40
 *    tracks whose prompt states the BPM, only 11 came back right and most of the
 *    rest were exactly doubled. So when a reading is fast enough to be a
 *    subdivision, compare it with the agents one octave down and prefer the
 *    slower grid if its beats are clearly stronger on average (`perBeat`).
 *    Averaging per beat is what makes the comparison meaningful: the fast grid
 *    has more beats, so its total score is larger even when its extra beats are
 *    weak.
 *
 * Kept separate from audio-features.ts so it can be tested with synthetic
 * click tracks instead of an ffmpeg round-trip.
 */
const HOP_SAMPLES = 441;

/** Halving anything slower than this is wrong for dance music, so don't try. */
const HALF_CHECK_MIN_BPM = 115;
/** How much stronger the slower grid's average onset has to be to win. */
const HALF_CHECK_SCORE_RATIO = 1.2;
/** Two agents further apart than this are different grids, not one octave. */
const OCTAVE_TOLERANCE = 0.06;
/** Guards against a cascade: 200 → 100 → 50 is never a real answer. */
const MAX_HALVINGS = 2;

interface BeatAgent {
  bpm: number;
  score: number;
  perBeat: number;
}

interface TempoResult {
  tempo?: string | number;
  agents?: { beatInterval: number; score: number; events?: unknown[] }[];
}

function readAgents(result: TempoResult): BeatAgent[] {
  return (result.agents ?? [])
    .map((agent) => ({
      bpm: 60 / agent.beatInterval,
      score: agent.score,
      perBeat: agent.score / Math.max(1, agent.events?.length ?? 1),
    }))
    .filter((agent) => Number.isFinite(agent.bpm) && agent.bpm >= 40 && agent.bpm <= 220);
}

function strongest(agents: BeatAgent[], key: (agent: BeatAgent) => number): BeatAgent {
  return agents.reduce((best, agent) => (key(agent) > key(best) ? agent : best), agents[0]);
}

function chooseBeatLevel(agents: BeatAgent[]): BeatAgent | null {
  if (agents.length === 0) return null;

  let best = strongest(agents, (agent) => agent.score);
  for (let step = 0; step < MAX_HALVINGS && best.bpm > HALF_CHECK_MIN_BPM; step++) {
    const slower = agents.filter(
      (agent) => Math.abs(agent.bpm * 2 - best.bpm) / best.bpm < OCTAVE_TOLERANCE,
    );
    if (slower.length === 0) break;

    const candidate = strongest(slower, (agent) => agent.perBeat);
    if (candidate.perBeat <= best.perBeat * HALF_CHECK_SCORE_RATIO) break;
    best = candidate;
  }
  return best;
}

export function detectTempo(samples: Float32Array, sampleRate: number): number | null {
  try {
    const result = new MusicTempo(samples, {
      timeStep: HOP_SAMPLES / sampleRate,
    }) as unknown as TempoResult;

    const chosen = chooseBeatLevel(readAgents(result));
    const bpm = chosen ? chosen.bpm : Number(result?.tempo);
    if (!Number.isFinite(bpm) || bpm <= 0) return null;
    return Math.round(bpm);
  } catch (error) {
    console.warn("[tempo] Tempo detection failed:", error);
    return null;
  }
}
