import { callLLM } from "@/lib/providers/llm";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  const lyrics = track.lyrics?.trim() || null;
  const prompt = track.prompt || null;
  const hasLyrics = !!lyrics && !track.instrumental;

  const systemPrompt = `You are a professional music producer, songwriter, and critic.

Perform a thorough analysis of the given song and provide up to 5 actionable tips for improvement.

Rules:
- Return ONLY strict JSON, no markdown, no code fences, no explanation outside the JSON.
- Format exactly: {"lyricsAnalysis": "short paragraph on lyrics quality", "compositionAnalysis": "short paragraph on composition/mix quality", "tips": ["tip1", "tip2", "tip3", "tip4", "tip5"]}
- Each tip: 1-2 sentences, specific and actionable.
- Maximum 5 tips (fewer OK if not applicable).
- If lyrics are not available, set lyricsAnalysis to null.
- Be honest and critical — the goal is improvement.`;

  let userContent = `Song style/prompt: ${prompt || "Not provided"}`;
  if (hasLyrics) {
    userContent += `\n\nLyrics:\n${lyrics!.slice(0, 4000)}`;
  }

  try {
    const raw = await callLLM(userContent, systemPrompt, { purpose: "advanced" });
    const cleaned = raw.replace(/^```[a-zA-Z]*\s*/g, "").replace(/\s*```$/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const result: AdvancedDnaResult = {
      lyricsAnalysis: typeof parsed.lyricsAnalysis === "string" ? parsed.lyricsAnalysis : null,
      compositionAnalysis: typeof parsed.compositionAnalysis === "string" ? parsed.compositionAnalysis : null,
      tips: Array.isArray(parsed.tips) ? parsed.tips.filter((t: unknown): t is string => typeof t === "string").slice(0, 5) : [],
    };

    // Persist the result so it survives page reloads.
    await db.update(tracks).set({ advancedDna: JSON.stringify(result) }).where(eq(tracks.id, trackId));

    return result;
  } catch (error) {
    console.error(`[advanced-dna] analysis failed for track ${trackId}:`, error);
    return null;
  }
}