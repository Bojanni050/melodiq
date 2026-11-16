import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { tracks } from "@/db/schema";
import { callLLM } from "@/lib/providers/llm";
import { toTitleCase } from "@/lib/title-case";

/**
 * Derives a fallback instrumental title synchronously from the style prompt.
 * No AI call — takes the first comma/newline segment, caps at 8 words / 80 chars.
 */
export function deriveInstrumentalTitleFallbackFromPrompt(prompt: string): string | null {
  const cleanedPrompt = prompt
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanedPrompt) return null;

  const primarySegment =
    cleanedPrompt
      .split(/[\n,;|]/)
      .map((segment) => segment.trim())
      .find(Boolean) || cleanedPrompt;

  const limitedWords = primarySegment.split(/\s+/).slice(0, 8).join(" ").trim();
  if (!limitedWords) return null;

  const capped = limitedWords.slice(0, 80).trim();
  return capped ? capped[0].toUpperCase() + capped.slice(1) : null;
}

/**
 * Normalises a raw LLM title response: strips surrounding quotes/whitespace,
 * removes brackets, collapses spaces, caps at 80 chars.
 */
export function normalizeAiTitle(raw: string): string | null {
  const firstLine = raw.split(/\r?\n/).find((line) => line.trim()) || "";
  const cleaned = firstLine
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/[\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, 80).trim();
}

/**
 * Calls the LLM to generate a concise (<=6 word) evocative title for an
 * instrumental track, based on the style prompt. Returns null on any failure.
 */
export async function generateInstrumentalTitleFromPrompt(prompt: string): Promise<string | null> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return null;

  const systemPrompt = `You generate concise song titles for instrumental tracks.

Rules:
- Return only the title
- No quotes, no punctuation at the end, no explanation
- Maximum 6 words
- Keep it evocative and based on the style prompt`;

  const userPrompt = `Create one instrumental track title from this style prompt:\n\n${trimmedPrompt}`;

  try {
    const rawTitle = await callLLM(userPrompt, systemPrompt, { purpose: "prompt", temperature: 0.4 });
    return normalizeAiTitle(rawTitle);
  } catch {
    return null;
  }
}

/**
 * Resolves the final track title for a generation request.
 * Priority: userTitle -> AI title (instrumental only, opt-in) -> derived fallback -> prompt slice (PoYo)
 *
 * `allowAiTitle` defaults to false: the AI title call used to sit in front of
 * every instrumental generation (1-3s, plus a paid call) while a deterministic
 * fallback was already being computed a few lines further down. Callers that
 * want the AI title now schedule `scheduleInstrumentalTitleUpgrade()` after the
 * track row exists instead of blocking the provider dispatch on it.
 */
export async function resolveTrackTitle({
  userTitle,
  instrumental,
  prompt,
  provider,
  allowAiTitle = false,
}: {
  userTitle: string;
  instrumental: boolean;
  prompt: string;
  provider: string;
  allowAiTitle?: boolean;
}): Promise<string | null> {
  const normalizedTitle = userTitle.trim();
  const normalizedPrompt = prompt.trim();

  const aiInstrumentalTitle =
    allowAiTitle && !normalizedTitle && instrumental
      ? await generateInstrumentalTitleFromPrompt(normalizedPrompt)
      : null;

  const derivedInstrumentalTitle = instrumental
    ? deriveInstrumentalTitleFallbackFromPrompt(normalizedPrompt)
    : null;

  const resolvedTitleRaw =
    normalizedTitle ||
    aiInstrumentalTitle ||
    derivedInstrumentalTitle ||
    (provider === "poyo" && normalizedPrompt ? normalizedPrompt.slice(0, 80) : null);

  return resolvedTitleRaw ? toTitleCase(resolvedTitleRaw) : null;
}

/**
 * Fire-and-forget title upgrade for an instrumental track: the AI title is nice
 * to have, but it should not hold up the provider call, and the provider keeps
 * the derived title it was dispatched with — this only changes what MelodiQ's
 * own library shows.
 *
 * Only overwrites the title this flow set itself (`eq(tracks.title,
 * currentTitle)`), so a user edit or a title that arrived from a webhook wins.
 */
export function scheduleInstrumentalTitleUpgrade(params: {
  trackId: string;
  prompt: string;
  currentTitle: string | null;
}): void {
  const prompt = params.prompt.trim();
  const currentTitle = params.currentTitle?.trim();
  if (!prompt || !currentTitle) return;

  void (async () => {
    try {
      const aiTitle = await generateInstrumentalTitleFromPrompt(prompt);
      const normalized = aiTitle ? toTitleCase(aiTitle) : null;
      if (!normalized || normalized === currentTitle) return;

      const updated = await db
        .update(tracks)
        .set({ title: normalized })
        .where(and(eq(tracks.id, params.trackId), eq(tracks.title, currentTitle)))
        .returning({ id: tracks.id });

      if (updated.length === 0) {
        console.info(`[title] track ${params.trackId}: title changed in the meantime, keeping the existing one`);
      } else {
        console.info(`[title] track ${params.trackId}: AI title "${normalized}" applied`);
      }
    } catch (error) {
      console.warn(`[title] track ${params.trackId}: AI title upgrade failed:`, error);
    }
  })();
}
