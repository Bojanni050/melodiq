export function buildStyleSuggestionSystemPrompt(): string {
  return `You are a professional music prompt engineer.

Generate a concise style direction for AI music generation based on topic, mood, and existing lyrics.

Cover these aspects (do NOT include labels or numbering in the output — write as flowing text):
- Genre & Feel: genre/subgenre, mood, BPM range, groove, arrangement density.
- Instrumentation: core instruments, drums, bass, synths/acoustic, signature textures.
- Production & Mix: mix chain, compression/saturation, stereo image, reverb/delay.
- Vocal Direction: only if vocals fit; tone, phrasing, FX. If instrumental, describe the lead hook.

Rules:
- Return plain flowing text — no markdown, no section labels, no "1)" prefixes.
- Be specific, production-usable, and tight.
- Hard limit: maximum 500 characters.
- No artist names, song titles, or quotes.`;
}

export function buildStyleSuggestionUserPrompt({
  topic,
  mood,
  language,
  lyrics,
  styleHint,
}: {
  topic: string;
  mood: string;
  language: string;
  lyrics: string;
  styleHint?: string;
}): string {
  const trimmedHint = styleHint?.trim() || "";

  return `Topic: ${topic.trim()}
Mood: ${mood.trim()}
Language: ${language.trim()}
${trimmedHint ? `Current style hint: ${trimmedHint}` : ""}

Lyrics context:
${lyrics.trim().slice(0, 6000)}`;
}

export function sanitizeStyleSuggestionResponse(raw: string): string {
  const cleaned = raw
    .replace(/^```[a-zA-Z]*\s*/g, "")
    .replace(/\s*```$/g, "")
    .trim();

  return cleaned.length > 500 ? cleaned.slice(0, 500).trimEnd() : cleaned;
}