import { franc } from "franc";

/**
 * Local lyrics-language detection.
 *
 * Why this exists instead of the LLM detector in providers/llm.ts: Smart
 * Archive scores groups on language, and the LLM path only ever ran for tracks
 * the user had actually played. On a cold library that column was mostly NULL,
 * so the signal was dead weight on exactly the tracks it was meant to help. It
 * also made the feature silently depend on a network call and an API key.
 *
 * franc is MIT-licensed, pure JavaScript and ships its trigram profiles in the
 * package, so there is no model file to download, no native build step (which
 * matters: this app builds in an Alpine container) and no per-call cost. On
 * real lyric excerpts in all thirteen languages Lyric Studio supports it scored
 * 13/13.
 *
 * The `only` filter is load-bearing, not an optimisation. franc recognises 400+
 * languages and without it answers "nds" (Low German) for Dutch and "bho"
 * (Bhojpuri) for Hindi — both correct in general, both wrong for this app,
 * because Lyric Studio offers neither. Restricting the answer set to the
 * languages the user can actually pick makes the missing cases fall through to
 * "unknown" instead of being mislabelled.
 */

/** ISO 639-3 codes, matching the shape `franc` returns. */
const SUPPORTED = [
  "nld", // Dutch
  "eng", // English
  "fra", // French
  "deu", // German
  "spa", // Spanish
  "ita", // Italian
  "por", // Portuguese
  "pol", // Polish
  "srp", // Serbian
  "jpn", // Japanese
  "kor", // Korean
  "hin", // Hindi
  "cmn", // Mandarin
] as const;

export type DetectedLanguage = (typeof SUPPORTED)[number];

/**
 * Lyric Studio's language codes (lyrics-studio-constants.ts), so a detected
 * language can be compared with what the user picked by hand and with the
 * values already stored in tracks.language.
 */
const LYRICS_STUDIO_CODE: Record<DetectedLanguage, string> = {
  nld: "nl",
  eng: "en",
  fra: "fr",
  deu: "de",
  spa: "es",
  ita: "it",
  por: "pt",
  pol: "pl",
  srp: "sr",
  jpn: "ja",
  kor: "ko",
  hin: "hi",
  cmn: "zh",
};

/** Human-readable label for the group chip in Smart Archive. */
const LABEL: Record<DetectedLanguage, string> = {
  nld: "Dutch",
  eng: "English",
  fra: "French",
  deu: "German",
  spa: "Spanish",
  ita: "Italian",
  por: "Portuguese",
  pol: "Polish",
  srp: "Serbian",
  jpn: "Japanese",
  kor: "Korean",
  hin: "Hindi",
  cmn: "Mandarin",
};

/**
 * franc's own floor. Below this there is not enough text to call anything, and
 * it is deliberately conservative: a short chorus is exactly the case where a
 * wrong label would mis-group two songs.
 */
const MIN_LENGTH = 10;

/** A single token may make up at most this share of the words. Instrumental
 *  intros and outros are literally "oh oh oh" or "la la la", and franc reads
 *  those confidently — "la la la la la la" comes back as Spanish. A lyric has a
 *  vocabulary, so a text dominated by one repeated token is a chant, not
 *  lyrics, and naming its language would be a fabrication. */
const MAX_SINGLE_WORD_SHARE = 0.6;

/**
 * Detects the language of a lyric string, returning the code Lyric Studio uses
 * ("nl", "en", ...) or null when it cannot tell.
 *
 * Null is a normal outcome, not a failure. Callers treat an unknown language as
 * "no evidence" — in Smart Archive an unknown language simply does not
 * contribute to the score — so declining leaves existing behaviour untouched
 * instead of asserting something wrong. That is also what happens for
 * instrumental tracks, empty lyrics and gibberish: franc returns "und" for
 * those, and since German is filtered in, they fall through to null.
 */
export function detectLyricsLanguage(lyrics: string | null | undefined): string | null {
  if (!lyrics) return null;

  // Drop bracketed section tags ([Verse], [Chorus]) first. Those are English
  // boilerplate present on every track, and counting them made a short
  // non-English track look English.
  const text = lyrics.replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ");

  // Repetition guard, but only for space-delimited scripts. Chinese and Japanese
  // are written without spaces, so a whole line is one "word" here and the guard
  // would reject every CJK lyric as a chant. Those scripts are decided by franc
  // on their own characters and need no such help.
  if (/\s/.test(text)) {
    const words = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
    if (words.length > 0) {
      const counts = new Map<string, number>();
      for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
      const mostCommon = Math.max(...counts.values());
      if (mostCommon / words.length > MAX_SINGLE_WORD_SHARE) return null;
    }
  }

  const detected = franc(text, { only: [...SUPPORTED], minLength: MIN_LENGTH });
  if (!detected) return null;

  return LYRICS_STUDIO_CODE[detected as DetectedLanguage] ?? null;
}

/** "nl" -> "Dutch" for display, or null when the code is unknown. */
export function detectedLanguageLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const entry = (Object.keys(LABEL) as DetectedLanguage[]).find(
    (key) => LYRICS_STUDIO_CODE[key] === code.toLowerCase()
  );
  return entry ? LABEL[entry] : null;
}

export { SUPPORTED as SUPPORTED_LANGUAGE_CODES };
