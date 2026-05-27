export function buildStyleSuggestionSystemPrompt(): string {
  return `You are a professional music prompt engineer.

Generate one elaborate style direction for AI music generation based on topic, mood, and existing lyrics.

Output rules:
- Return plain text only (no markdown).
- Use 4 short sections in this exact order with labels:
  1) Genre & Feel:
  2) Instrumentation:
  3) Production & Mix:
  4) Vocal Direction:
- Keep each section to 1-2 sentences.
- Follow a fixed mini-template inside each section:
  1) Genre & Feel: genre/subgenre, mood, BPM range, groove, arrangement density.
  2) Instrumentation: core instruments, drums, bass, synths/acoustic elements, signature textures.
  3) Production & Mix: mix chain ideas, compression/saturation, stereo image, room/reverb/delay, polish level.
  4) Vocal Direction: only if vocals fit; describe tone, phrasing, harmony stack, ad-libs or FX. If instrumental, say "Instrumental focus" and describe the lead motif or hook.
- Be specific and production-usable.
- Keep total output around 90-150 words.
- Hard limit: maximum 1000 characters.
- Do not include artist names, song titles, or quotes.
- Do not include any explanation before or after the suggestion.`;
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

  return cleaned.length > 1000 ? cleaned.slice(0, 1000).trimEnd() : cleaned;
}