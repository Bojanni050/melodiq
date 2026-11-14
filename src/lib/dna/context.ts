/**
 * Turns a Melody DNA profile into a compact style hint for the generators.
 *
 * The point is not to dump the whole profile into every prompt. A generation
 * prompt is a style description with a hard character limit (1000 in the UI,
 * 2000 in /api/generate), so this module answers one question: what is the
 * shortest text that meaningfully steers a generator towards this user's
 * catalogue? Everything here is pure so the weighting and the limits are
 * testable without a database.
 */

export const DNA_STRENGTHS = ["off", "subtle", "strong"] as const;
export type DnaStrength = (typeof DNA_STRENGTHS)[number];

export const DNA_PROMPT_LIMIT = 2000;

/**
 * Below this, a trait is a guess rather than a pattern. Injecting guesses into
 * every prompt makes the generator confidently wrong, so they stay out.
 */
export const MIN_CONTEXT_CONFIDENCE = 0.35;

/** `subtle` keeps the hint short enough to read as one extra style tag. */
const SUBTLE_FRAGMENTS = 4;
const STRONG_FRAGMENTS = 8;

/** Marks the appended hint so it can be recognised (and stripped) again. */
export const DNA_HINT_PREFIX = "Melody DNA: ";

/** Bare minimum of room left over before we append anything at all. */
const MIN_DNA_ROOM = 40;

export type DnaContextTrait = {
  key: string;
  label: string;
  value: number | null;
  /** JSON list for kind="list", plain text otherwise. */
  text: string | null;
  display: string | null;
  confidence: number;
  verdict?: "confirmed" | "disputed" | null;
  direction?: "more" | "less" | null;
};

export type DnaContextInput = {
  traits: DnaContextTrait[];
};

/** Order matters: genres and tempo read first in a style string. */
const FRAGMENT_ORDER = [
  "genres",
  "tempo",
  "energy",
  "vocal_gender",
  "language",
  "instrumental_share",
  "atmospheres",
  "length",
  "loved_genres",
  "avoided_genres",
] as const;

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

type FragmentBuilder = (trait: DnaContextTrait) => string | null;

const FRAGMENT_BUILDERS: Record<string, FragmentBuilder> = {
  genres: (trait) => {
    const genres = parseList(trait.text).slice(0, 2);
    return genres.length > 0 ? genres.join(" / ") : null;
  },
  tempo: (trait) =>
    typeof trait.value === "number" ? `${Math.round(trait.value)} BPM` : null,
  energy: (trait) => {
    if (typeof trait.value !== "number") return null;
    if (trait.value >= 70) return "high energy";
    if (trait.value >= 40) return "mid energy";
    return "gentle energy";
  },
  vocal_gender: (trait) => {
    const text = trait.text?.trim();
    if (!text) return null;
    return text === "mixed" || text === "both" ? "mixed vocals" : `${text} vocals`;
  },
  language: (trait) => {
    const text = trait.text?.trim();
    return text ? `${text} lyrics` : null;
  },
  instrumental_share: (trait) => {
    if (typeof trait.value !== "number") return null;
    return trait.value >= 0.5 ? "mostly instrumental" : null;
  },
  atmospheres: (trait) => {
    const tags = parseList(trait.text).slice(0, 2);
    return tags.length > 0 ? `${tags.join(", ")} atmospheres` : null;
  },
  length: (trait) =>
    typeof trait.value === "number" ? `~${formatSeconds(trait.value)} songs` : null,
  loved_genres: (trait) => {
    const genres = parseList(trait.text).slice(0, 2);
    return genres.length > 0 ? `loves ${genres.join(", ")}` : null;
  },
  avoided_genres: (trait) => {
    const genres = parseList(trait.text).slice(0, 2);
    return genres.length > 0 ? `avoids ${genres.join(", ")}` : null;
  },
};

/**
 * A trait is usable when it cleared the confidence bar and the user has not
 * rejected it. "Confirmed" always wins — that is explicit evidence.
 */
function isUsable(trait: DnaContextTrait): boolean {
  if (trait.verdict === "disputed") return false;
  if (trait.verdict === "confirmed") return true;
  return trait.confidence >= MIN_CONTEXT_CONFIDENCE;
}

/**
 * Builds the hint text. Returns an empty string when there is nothing solid
 * enough to say, so callers can simply skip appending.
 */
export function buildDnaContext(
  input: DnaContextInput,
  strength: DnaStrength
): string {
  if (strength === "off") return "";

  const byKey = new Map(input.traits.map((trait) => [trait.key, trait]));
  const fragments: string[] = [];
  const genreText: string[] = [];

  for (const key of FRAGMENT_ORDER) {
    const trait = byKey.get(key);
    if (!trait || !isUsable(trait)) continue;

    const builder = FRAGMENT_BUILDERS[key];
    const fragment = builder?.(trait);
    if (!fragment) continue;

    // "indie pop / dream pop" already implies "loves dream pop"; repeating it
    // wastes characters that the style field needs.
    if (key === "loved_genres") {
      const known = genreText.join(" ").toLowerCase();
      const isRedundant = parseList(trait.text)
        .slice(0, 2)
        .every((genre) => known.includes(genre.toLowerCase()));
      if (isRedundant) continue;
    }

    if (key === "genres" || key === "loved_genres") genreText.push(fragment);
    fragments.push(fragment);
  }

  const limit = strength === "subtle" ? SUBTLE_FRAGMENTS : STRONG_FRAGMENTS;
  const parts = fragments.slice(0, limit);

  // Directions come from the user's own "more/less" corrections. They are
  // wishes, not measurements, which is exactly why they are worth appending.
  const more = input.traits
    .filter((trait) => trait.direction === "more" && trait.verdict !== "disputed")
    .map((trait) => trait.label.toLowerCase());
  const less = input.traits
    .filter((trait) => trait.direction === "less" && trait.verdict !== "disputed")
    .map((trait) => trait.label.toLowerCase());

  if (more.length > 0) parts.push(`wants more ${more.slice(0, 3).join(", ")}`);
  if (less.length > 0) parts.push(`wants less ${less.slice(0, 3).join(", ")}`);

  return parts.join(", ");
}

function trimToWord(text: string, limit: number): string {
  if (limit <= 0) return "";
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);

  // Prefer a whole fragment; the comparison is on the amount kept, otherwise a
  // short break near the end looks like a good one.
  const lastBreak = cut.lastIndexOf(", ");
  if (lastBreak >= MIN_DNA_ROOM) return cut.slice(0, lastBreak).trim();

  const lastSpace = cut.lastIndexOf(" ");
  const wordCut = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
  // A dangling comma or space reads like a broken tag list.
  return wordCut.replace(/[,;:\s]+$/, "");
}

/**
 * Appends the hint to the user's prompt. The user's own text is never cut:
 * when there is not enough room the hint is trimmed, and when there is almost
 * no room it is dropped entirely.
 */
export function mergeDnaIntoPrompt(
  prompt: string,
  context: string,
  strength: DnaStrength,
  limit: number = DNA_PROMPT_LIMIT
): string {
  const base = prompt.trim();
  const hint = context.trim();
  if (strength === "off" || !hint) return base;

  const joiner = ", ";
  const prefix = DNA_HINT_PREFIX;
  const room = limit - base.length - joiner.length - prefix.length;
  if (room < MIN_DNA_ROOM) return base;

  const fitted = trimToWord(hint, room);
  return fitted ? `${base}${joiner}${prefix}${fitted}` : base;
}

/**
 * Removes a hint that a previous generation appended, so reusing a prompt does
 * not stack DNA lines on top of each other. Only the trailing segment the
 * merger created is removed — a user who typed "Melody DNA:" mid-prompt keeps
 * their own words.
 */
export function stripDnaHint(prompt: string): string {
  const marker = `, ${DNA_HINT_PREFIX}`;
  const at = prompt.lastIndexOf(marker);
  if (at >= 0) return prompt.slice(0, at).trim();
  if (prompt.startsWith(DNA_HINT_PREFIX)) return "";
  return prompt;
}
