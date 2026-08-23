import { extractAudioFeatures } from "@/lib/audio-features";
import { extractAtmosphereTags, scoreLyricsQuality } from "@/lib/providers/llm";
import type { AudioDna } from "@/lib/songs";

/**
 * Computes the full auto Track DNA payload for a just-finalized track: audio
 * DSP features (tempo/key/energy/loudness) plus LLM-derived atmosphere tags
 * and lyrics score. Called once from each provider webhook right after the
 * audio buffer is downloaded, alongside the existing extractAudioDuration
 * call. Returns a JSON string ready for the tracks.audioDna column; never
 * throws — a failing sub-analysis just leaves that field null.
 *
 * Composition/arrangement critique now lives entirely in "Advanced Track
 * DNA" (advanced-dna-analysis.ts), which listens to the audio directly —
 * there's no separate auto-computed composition score anymore.
 */
export async function computeAudioDna(params: {
  audioBuffer: Buffer;
  prompt: string;
  lyrics: string | null;
  instrumental: boolean;
}): Promise<string> {
  const [features, atmosphereTags, lyricsResult] = await Promise.all([
    extractAudioFeatures(params.audioBuffer).catch((error) => {
      console.warn("[audio-dna] Audio feature extraction failed:", error);
      return null;
    }),
    extractAtmosphereTags(params.prompt).catch((error) => {
      console.warn("[audio-dna] Atmosphere tag extraction failed:", error);
      return null;
    }),
    !params.instrumental && params.lyrics
      ? scoreLyricsQuality(params.lyrics).catch((error) => {
          console.warn("[audio-dna] Lyrics scoring failed:", error);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const audioDna: AudioDna = {
    tempo: features?.tempo ?? null,
    key: features?.key ?? null,
    energy: features?.energy ?? null,
    loudness: features?.loudness ?? null,
    atmosphereTags: atmosphereTags ?? null,
    lyricsScore: lyricsResult?.score ?? null,
    lyricsNotes: lyricsResult?.notes ?? null,
    compositionScore: null,
    compositionNotes: null,
    computedAt: new Date().toISOString(),
  };

  return JSON.stringify(audioDna);
}
