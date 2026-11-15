import MusicTempo from "music-tempo";

/**
 * Detect BPM from mono PCM.
 *
 * music-tempo's internals assume 44.1 kHz: it cuts the signal in 441-sample hops
 * and labels each hop 10 ms (`timeStep`). Decode at anything else and every
 * inter-onset interval is read at the wrong length — at 22.05 kHz a hop is 20 ms,
 * so all intervals looked half as long and anything slower than ~100 BPM came
 * back doubled (an 85 BPM song measured 170). Passing the real hop duration
 * fixes the octave error at the source, so no post-hoc halving is needed.
 *
 * Kept separate from audio-features.ts so it can be tested with a synthetic
 * click track instead of an ffmpeg round-trip.
 */
const HOP_SAMPLES = 441;

export function detectTempo(samples: Float32Array, sampleRate: number): number | null {
  try {
    const timeStep = HOP_SAMPLES / sampleRate;
    const result = new MusicTempo(samples, { timeStep });
    return result?.tempo ? Math.round(Number(result.tempo)) : null;
  } catch (error) {
    console.warn("[tempo] Tempo detection failed:", error);
    return null;
  }
}
