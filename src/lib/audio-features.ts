import ffmpegStatic from "ffmpeg-static";
import { spawn } from "child_process";
import { Readable } from "stream";
import MusicTempo from "music-tempo";
import FFT from "fft.js";

export interface AudioFeatures {
  tempo: number | null;
  key: string | null;
  energy: number | null;
  loudness: number | null;
}

const SAMPLE_RATE = 22050;

/**
 * Extract objective audio characteristics (tempo, key, energy, loudness) from a
 * generated track's audio buffer — the DSP counterpart to extractAudioDuration.
 * Never throws: any failing sub-analysis just comes back null so one bad signal
 * doesn't block the others or the track finalization that calls this.
 */
export async function extractAudioFeatures(buffer: Buffer): Promise<AudioFeatures | null> {
  if (!ffmpegStatic) {
    console.warn("[audio-features] ffmpeg-static not available");
    return null;
  }

  const [pcm, loudness] = await Promise.all([
    decodeToPcm(buffer).catch((error) => {
      console.warn("[audio-features] PCM decode failed:", error);
      return null;
    }),
    measureLoudness(buffer).catch((error) => {
      console.warn("[audio-features] Loudness measurement failed:", error);
      return null;
    }),
  ]);

  if (!pcm) {
    return { tempo: null, key: null, energy: null, loudness };
  }

  return {
    tempo: detectTempo(pcm),
    key: detectKey(pcm),
    energy: computeEnergy(pcm),
    loudness,
  };
}

function decodeToPcm(buffer: Buffer): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegStatic as string, [
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

function measureLoudness(buffer: Buffer): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegStatic as string, [
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

function detectTempo(samples: Float32Array): number | null {
  try {
    const result = new MusicTempo(samples);
    return result?.tempo ? Math.round(result.tempo) : null;
  } catch (error) {
    console.warn("[audio-features] Tempo detection failed:", error);
    return null;
  }
}

function computeEnergy(samples: Float32Array): number | null {
  if (samples.length === 0) return null;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
  const rms = Math.sqrt(sumSquares / samples.length);
  // 0.3 RMS is a loud, heavily-limited master; used as a practical ceiling to
  // scale into a 0-100 "energy" figure rather than a raw, hard-to-read RMS value.
  return Math.round(Math.min(1, rms / 0.3) * 100);
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
