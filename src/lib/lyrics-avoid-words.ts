// Words/phrases that read as an obvious AI-writing tell in song lyrics.
// Add to this list whenever a generated lyric leans on a giveaway word —
// it's shared by every lyrics-generation and lyrics-improvement prompt.
export const LYRICS_AVOID_WORDS = [
  "neon",
  "electric",
  "tapestry",
  "symphony",
  "kaleidoscope",
  "labyrinth",
  "ethereal",
  "whispers of",
  "echoes of",
  "shadows and light",
  "ignite",
  "unravel",
];

export function buildAvoidWordsInstruction(): string {
  return `Avoid these overused, tell-tale AI-writing words and phrases unless the topic genuinely demands one: ${LYRICS_AVOID_WORDS.join(", ")}.`;
}
