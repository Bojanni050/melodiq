import ffmpegStatic from "ffmpeg-static";
import { spawn } from "child_process";
import { Readable } from "stream";
import FFT from "fft.js";
import { detectTempo } from "@/lib/tempo";

export interface AudioFeatures {
  tempo: number | null;
  key: string | null;
  energy: number | null;
  loudness: number | null;
  /** RMS energy (0-100) per equal slice of the track: the shape of the song. */
  energyArc: number[] | null;
  /**
   * Whether the track reaches (near) its own peak energy inside the first 30
   * seconds — a DSP stand-in for "the hook arrives early", since the audio DNA
   * has no section timestamps.
   */
  hookEarly: boolean | null;
}

const SAMPLE_RATE = 22050;
const ARC_BUCKETS = 12;
const HOOK_WINDOW_SECONDS = 30;
// Relative to the track's median bucket energy, not its peak (see hookEarlyFromArc).
const HOOK_MEDIAN_SHARE = 0.9;
// Below this the track is so quiet that its median says nothing about a hook.
const HOOK_ENERGY_FLOOR = 10;

// ffmpeg-static's bundled binary is built against glibc and fails silently
// (ENOENT/exec-format error) on the Alpine/musl base image this app is
// deployed on — so prefer the system `ffmpeg` (installed via apk in the
// Dockerfile) when it's on PATH, and only fall back to the bundled static
// binary for local dev environments (e.g. Windows) that lack a system ffmpeg.
let ffmpegPathPromise: Promise<string | null> | null = null;

function resolveFfmpegPath(): Promise<string | null> {
  if (!ffmpegPathPromise) {
    ffmpegPathPromise = new Promise((resolve) => {
      const probe = spawn("ffmpeg", ["-version"]);
      probe.on("error", () => resolve((ffmpegStatic as string | null) ?? null));
      probe.on("close", (code) => resolve(code === 0 ? "ffmpeg" : ((ffmpegStatic as string | null) ?? null)));
    });
  }
  return ffmpegPathPromise;
}

/**
 * Extract objective audio characteristics (tempo, key, energy, loudness) from a
 * generated track's audio buffer — the DSP counterpart to extractAudioDuration.
 * Never throws: any failing sub-analysis just comes back null so one bad signal
 * doesn't block the others or the track finalization that calls this.
 */
export async function extractAudioFeatures(buffer: Buffer): Promise<AudioFeatures | null> {
  const ffmpegPath = await resolveFfmpegPath();
  if (!ffmpegPath) {
    console.warn("[audio-features] no working ffmpeg binary found (system PATH or ffmpeg-static)");
    return null;
  }

  const [pcm, loudness] = await Promise.all([
    decodeToPcm(buffer, ffmpegPath).catch((error) => {
      console.warn("[audio-features] PCM decode failed:", error);
      return null;
    }),
    measureLoudness(buffer, ffmpegPath).catch((error) => {
      console.warn("[audio-features] Loudness measurement failed:", error);
      return null;
    }),
  ]);

  if (!pcm) {
    return { tempo: null, key: null, energy: null, loudness, energyArc: null, hookEarly: null };
  }

  const energyArc = computeEnergyArc(pcm);

  return {
    tempo: detectTempo(pcm, SAMPLE_RATE),
    key: detectKey(pcm),
    energy: computeEnergy(pcm),
    loudness,
    energyArc,
    hookEarly: detectHookEarly(pcm),
  };
}

function decodeToPcm(buffer: Buffer, ffmpegPath: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      "-i", "pipe:0",
      "-f", "s16le",
      "-acodec", "pcm_s16le",
      "-ac", "1",
      "-ar", String(SAMPLE_RATE),
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
        return;
      }
      const raw = Buffer.concat(chunks);
      const samples = new Float32Array(Math.floor(raw.length / 2));
      for (let i = 0; i < samples.length; i++) {
        samples[i] = raw.readInt16LE(i * 2) / 32768;
      }
      resolve(samples);
    });

    const readable = Readable.from(buffer);
    readable.pipe(proc.stdin);
    readable.on("error", reject);
  });
}

function measureLoudness(buffer: Buffer, ffmpegPath: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      "-i", "pipe:0",
      "-af", "loudnorm=print_format=json",
      "-f", "null",
      "-",
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("error", reject);
    proc.on("close", () => {
      const match = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
      if (!match) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(match[0]);
        const lufs = parseFloat(parsed.input_i);
        resolve(Number.isFinite(lufs) ? lufs : null);
      } catch {
        resolve(null);
      }
    });

    const readable = Readable.from(buffer);
    readable.pipe(proc.stdin);
    readable.on("error", reject);
  });
}

function rms(samples: Float32Array, start: number, end: number): number {
  let sumSquares = 0;
  for (let i = start; i < end; i++) sumSquares += samples[i] * samples[i];
  const length = end - start;
  return length > 0 ? Math.sqrt(sumSquares / length) : 0;
}

// 0.3 RMS is a loud, heavily-limited master; used as a practical ceiling to
// scale into a 0-100 "energy" figure rather than a raw, hard-to-read RMS value.
function energyOf(rmsValue: number): number {
  return Math.round(Math.min(1, rmsValue / 0.3) * 100);
}

function computeEnergy(samples: Float32Array): number | null {
  if (samples.length === 0) return null;
  return energyOf(rms(samples, 0, samples.length));
}

/**
 * Splits the track into equal buckets and measures RMS energy in each, so the
 * DNA can describe the arc (builds / starts strong / steady) rather than only
 * one average. Twelve buckets is enough for a shape and cheap to compute: the
 * PCM is already decoded for tempo and key.
 */
function computeEnergyArc(samples: Float32Array): number[] | null {
  if (samples.length < ARC_BUCKETS) return null;
  const bucketSize = Math.floor(samples.length / ARC_BUCKETS);
  if (bucketSize === 0) return null;
  const arc: number[] = [];
  for (let bucket = 0; bucket < ARC_BUCKETS; bucket++) {
    arc.push(energyOf(rms(samples, bucket * bucketSize, (bucket + 1) * bucketSize)));
  }
  return arc;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * "Hook before 0:30" without section detection: the point where the track first
 * reaches its own median energy, i.e. where it settles at its typical level.
 * It is a proxy, not a chorus detector — a slow-burn intro reads false, an
 * early drop reads true.
 *
 * Measured at one-second resolution, not on the twelve-bucket arc: with a
 * three-minute track the 30-second window is only two buckets, so the arc
 * cannot tell "quiet for 25 s, then full" from "quiet the whole time". The
 * reference is the median rather than the peak: on a mastered track the peak
 * sits near 100 and a quiet intro at 40-50, so a peak-relative rule calls
 * virtually every song "no hook".
 *
 * Returns null when the track is too short or too quiet to judge.
 */
export function hookEarlyFromEnergies(perSecond: number[]): boolean | null {
  if (perSecond.length <= HOOK_WINDOW_SECONDS) return null;

  const median = medianOf(perSecond);
  if (median < HOOK_ENERGY_FLOOR) return null;

  const threshold = median * HOOK_MEDIAN_SHARE;
  const reached = perSecond.findIndex((value) => value >= threshold);
  return reached >= 0 && reached < HOOK_WINDOW_SECONDS;
}

function secondEnergies(samples: Float32Array): number[] {
  const energies: number[] = [];
  for (let start = 0; start + SAMPLE_RATE <= samples.length; start += SAMPLE_RATE) {
    energies.push(energyOf(rms(samples, start, start + SAMPLE_RATE)));
  }
  return energies;
}

function detectHookEarly(samples: Float32Array): boolean | null {
  return hookEarlyFromEnergies(secondEnergies(samples));
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// Krumhansl-Kessler key profiles: perceived stability of each pitch class relative to a tonic.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const FRAME_SIZE = 4096;
const HOP_SIZE = 2048;
const MIN_FREQ = 27.5;
const MAX_FREQ = 5000;

function detectKey(samples: Float32Array): string | null {
  try {
    const fft = new FFT(FRAME_SIZE);
    const chroma = new Array(12).fill(0);

    for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
      const frame = new Array(FRAME_SIZE);
      for (let i = 0; i < FRAME_SIZE; i++) {
        const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1));
        frame[i] = samples[start + i] * hann;
      }

      const out = fft.createComplexArray();
      fft.realTransform(out, frame);

      for (let bin = 1; bin < FRAME_SIZE / 2; bin++) {
        const re = out[bin * 2];
        const im = out[bin * 2 + 1];
        const magnitude = Math.sqrt(re * re + im * im);
        if (magnitude < 1e-6) continue;

        const freq = (bin * SAMPLE_RATE) / FRAME_SIZE;
        if (freq < MIN_FREQ || freq > MAX_FREQ) continue;

        const midiNote = 69 + 12 * Math.log2(freq / 440);
        const pitchClass = ((Math.round(midiNote) % 12) + 12) % 12;
        chroma[pitchClass] += magnitude;
      }
    }

    const total = chroma.reduce((sum, v) => sum + v, 0);
    if (total === 0) return null;
    const normalized = chroma.map((v) => v / total);

    let best: { score: number; label: string } | null = null;
    for (let root = 0; root < 12; root++) {
      const majorScore = correlate(normalized, rotate(MAJOR_PROFILE, root));
      const minorScore = correlate(normalized, rotate(MINOR_PROFILE, root));
      if (!best || majorScore > best.score) best = { score: majorScore, label: `${NOTE_NAMES[root]} major` };
      if (!best || minorScore > best.score) best = { score: minorScore, label: `${NOTE_NAMES[root]} minor` };
    }
    return best?.label ?? null;
  } catch (error) {
    console.warn("[audio-features] Key detection failed:", error);
    return null;
  }
}

function rotate(profile: number[], n: number): number[] {
  return profile.map((_, i) => profile[(i - n + 12) % 12]);
}

function correlate(a: number[], b: number[]): number {
  const meanA = a.reduce((sum, v) => sum + v, 0) / a.length;
  const meanB = b.reduce((sum, v) => sum + v, 0) / b.length;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}
