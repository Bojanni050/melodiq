import { extractAudioFeatures } from "@/lib/audio-features";
import { extractAtmosphereTags, scoreLyricsQuality, scoreCompositionQuality } from "@/lib/providers/llm";
import { getSetting } from "@/lib/settings";
import type { AudioDna } from "@/lib/songs";

/**
 * Computes the full auto Track DNA payload for a just-finalized track: audio
 * DSP features (tempo/key/energy/loudness) plus LLM-derived atmosphere tags,
 * lyrics score, and composition/arrangement score. Called once from each
 * provider webhook right after the audio buffer is downloaded, alongside the
 * existing extractAudioDuration call. Returns a JSON string ready for the
 * tracks.audioDna column; never throws — a failing sub-analysis just leaves
 * that field null.
 */
export async function computeAudioDna(params: {
  audioBuffer: Buffer;
  prompt: string;
  lyrics: string | null;
  instrumental: boolean;
}): Promise<string> {
  const autoAnalyzeComposition = (await getSetting("AUTO_ANALYZE_COMPOSITION")) === "true";

  const [features, atmosphereTags, lyricsResult, compositionResult] = await Promise.all([
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
    // Off by default (Settings → AI Routing) — composition scoring costs an
    // extra audio-model call per track, so it only runs automatically when
    // explicitly opted in. Manual per-track analysis (the "Analyze
    // Composition" track action) always works regardless of this setting.
    autoAnalyzeComposition
      ? scoreCompositionQuality(params.audioBuffer, "mp3").catch((error) => {
          console.warn("[audio-dna] Composition scoring failed:", error);
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
    compositionScore: compositionResult?.score ?? null,
    compositionNotes: compositionResult?.notes ?? null,
    computedAt: new Date().toISOString(),
  };

  return JSON.stringify(audioDna);
}
