import { callLLMWithAudio } from "@/lib/providers/llm";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { downloadFromS3 } from "@/lib/s3";
import { logToFile } from "@/lib/file-logger";

const LOG_FILE = "track-dna.log";
function log(message: string): void {
  console.info(message);
  logToFile(LOG_FILE, message);
}
function warn(message: string, error?: unknown): void {
  console.warn(message, error ?? "");
  logToFile(LOG_FILE, error ? `${message} ${error instanceof Error ? error.stack || error.message : String(error)}` : message);
}

export interface AdvancedDnaResult {
  lyricsAnalysis: string | null;
  compositionAnalysis: string | null;
  tips: string[];
}

function parseAdvancedDna(raw: string | null): AdvancedDnaResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdvancedDnaResult;
  } catch {
    return null;
  }
}

// "Advanced Track DNA" — the deep-dive analysis that actually listens to the
// rendered audio (unlike the quick text-only "Analyze Composition" score),
// combined with the lyrics/style prompt, to produce a written critique and
// concrete improvement tips.
export async function analyzeAdvancedDna(
  trackId: string,
  { forceRefresh = false }: { forceRefresh?: boolean } = {}
): Promise<AdvancedDnaResult | null> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!track) return null;

  // Return the cached result unless a refresh is explicitly requested.
  if (!forceRefresh && track.advancedDna) {
    const cached = parseAdvancedDna(track.advancedDna);
    if (cached) return cached;
  }

  const audioS3Key = track.s3KeyMp3 || track.s3Key;
  if (!audioS3Key) {
    warn(`[advanced-dna] track ${trackId}: no audio file available (s3Key/s3KeyMp3 both empty)`);
    return null;
  }
  const audioFormat = track.s3KeyMp3 ? "mp3" : track.format || "mp3";

  const lyrics = track.lyrics?.trim() || null;
  const prompt = track.prompt || null;
  const hasLyrics = !!lyrics && !track.instrumental;

  const systemPrompt = `You are a professional music producer, songwriter, and critic.

Listen to the audio and, together with the style/prompt and lyrics (if provided), perform a thorough analysis of the given song and provide up to 5 actionable tips for improvement.

Rules:
- Return ONLY strict JSON, no markdown, no code fences, no explanation outside the JSON.
- Format exactly: {"lyricsAnalysis": "short paragraph on lyrics quality", "compositionAnalysis": "short paragraph on composition/mix quality, grounded in what you actually hear", "tips": ["tip1", "tip2", "tip3", "tip4", "tip5"]}
- Each tip: 1-2 sentences, specific and actionable.
- Maximum 5 tips (fewer OK if not applicable).
- If lyrics are not available, set lyricsAnalysis to null.
- Be honest and critical — the goal is improvement.`;

  let userText = `Song style/prompt: ${prompt || "Not provided"}`;
  if (hasLyrics) {
    userText += `\n\nLyrics:\n${lyrics!.slice(0, 4000)}`;
  }

  try {
    const audioBuffer = await downloadFromS3(audioS3Key);
    log(
      `[advanced-dna] track ${trackId}: downloaded ${audioBuffer?.length ?? 0} bytes (format=${audioFormat}), hasLyrics=${hasLyrics}`
    );

    const raw = await callLLMWithAudio(
      "advanced",
      audioBuffer,
      audioFormat,
      systemPrompt,
      userText,
      "[llm][advanced]"
    );

    const cleaned = raw.replace(/^```[a-zA-Z]*\s*/g, "").replace(/\s*```$/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      warn(`[advanced-dna] track ${trackId}: could not find JSON in model response: ${JSON.stringify(cleaned.slice(0, 500))}`);
      return null;
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const result: AdvancedDnaResult = {
      lyricsAnalysis: typeof parsed.lyricsAnalysis === "string" ? parsed.lyricsAnalysis : null,
      compositionAnalysis: typeof parsed.compositionAnalysis === "string" ? parsed.compositionAnalysis : null,
      tips: Array.isArray(parsed.tips) ? parsed.tips.filter((t: unknown): t is string => typeof t === "string").slice(0, 5) : [],
    };

    // Persist the result so it survives page reloads.
    await db.update(tracks).set({ advancedDna: JSON.stringify(result) }).where(eq(tracks.id, trackId));

    log(`[advanced-dna] track ${trackId}: success, tips=${result.tips.length}`);
    return result;
  } catch (error) {
    warn(`[advanced-dna] analysis failed for track ${trackId}:`, error);
    return null;
  }
}
