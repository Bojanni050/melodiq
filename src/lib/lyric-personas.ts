/**
 * Lyric personas: a saved writing voice built from the user's own earlier
 * couplets and choruses. Shared by the API routes, the lyrics page and the
 * prompt builder, so the limits and normalisation live in one place.
 */

export type LyricPersonaFragmentKind = "couplet" | "chorus";

export interface LyricPersonaFragment {
  id: string;
  kind: LyricPersonaFragmentKind;
  text: string;
  sourceTitle: string;
}

export interface LyricPersona {
  id: string;
  name: string;
  bio: string;
  fragments: LyricPersonaFragment[];
  createdAt: string;
  updatedAt: string;
}

/** A persona trimmed down to what a generation prompt needs. */
export interface PromptLyricPersona {
  name: string;
  bio: string;
  fragments: Array<{ kind: LyricPersonaFragmentKind; text: string }>;
}

export const MAX_PERSONA_NAME = 120;
export const MAX_PERSONA_BIO = 2000;
export const MAX_PERSONA_FRAGMENTS = 20;
export const MAX_PROMPT_PERSONA_FRAGMENTS = 8;
export const MAX_PROMPT_FRAGMENT_LENGTH = 1000;

export function isLyricPersonaFragmentKind(value: unknown): value is LyricPersonaFragmentKind {
  return value === "couplet" || value === "chorus";
}

export function normalizeFragmentText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function sanitizePersonaFragment(value: unknown): LyricPersonaFragment | null {
  if (!value || typeof value !== "object") return null;
  const fragment = value as Record<string, unknown>;
  if (typeof fragment.text !== "string") return null;
  const text = normalizeFragmentText(fragment.text);
  if (!text) return null;

  return {
    id: typeof fragment.id === "string" && fragment.id.trim() ? fragment.id.trim() : `frag-${hashText(text)}`,
    kind: isLyricPersonaFragmentKind(fragment.kind) ? fragment.kind : "couplet",
    text: text.slice(0, MAX_PROMPT_FRAGMENT_LENGTH),
    sourceTitle: typeof fragment.sourceTitle === "string" ? fragment.sourceTitle.trim().slice(0, 255) : "",
  };
}

export function sanitizePersonaFragments(input: unknown, max = MAX_PERSONA_FRAGMENTS): LyricPersonaFragment[] {
  if (!Array.isArray(input)) return [];

  const result: LyricPersonaFragment[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const fragment = sanitizePersonaFragment(item);
    if (!fragment) continue;
    const key = `${fragment.kind}:${fragment.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(fragment);
    if (result.length >= max) break;
  }
  return result;
}

export function parseStoredPersonaFragments(raw: unknown): LyricPersonaFragment[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    return sanitizePersonaFragments(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Rebuilds a persona read back from localStorage or an old snapshot. */
export function sanitizePersona(value: unknown): LyricPersona | null {
  if (!value || typeof value !== "object") return null;
  const persona = value as Record<string, unknown>;
  const name = typeof persona.name === "string" ? persona.name.trim().slice(0, MAX_PERSONA_NAME) : "";
  if (!name) return null;

  return {
    id: typeof persona.id === "string" && persona.id.trim() ? persona.id.trim() : `persona-${hashText(name)}`,
    name,
    bio: typeof persona.bio === "string" ? persona.bio.trim().slice(0, MAX_PERSONA_BIO) : "",
    fragments: sanitizePersonaFragments(persona.fragments),
    createdAt: typeof persona.createdAt === "string" ? persona.createdAt : "",
    updatedAt: typeof persona.updatedAt === "string" ? persona.updatedAt : "",
  };
}

/**
 * Validates a persona for the generate-block route. Returns null when the
 * payload is not a usable persona, so the route can reject it instead of
 * silently writing without the direction the user picked.
 */
export function sanitizePromptPersona(value: unknown): PromptLyricPersona | null {
  if (!value || typeof value !== "object") return null;
  const persona = value as Record<string, unknown>;
  const name = typeof persona.name === "string" ? persona.name.trim().slice(0, MAX_PERSONA_NAME) : "";
  if (!name) return null;

  const bio = typeof persona.bio === "string" ? persona.bio.trim().slice(0, MAX_PERSONA_BIO) : "";
  const fragments = sanitizePersonaFragments(persona.fragments, MAX_PROMPT_PERSONA_FRAGMENTS).map(({ kind, text }) => ({
    kind,
    text: text.slice(0, MAX_PROMPT_FRAGMENT_LENGTH),
  }));

  return { name, bio, fragments };
}

/** Stable, short id so the same fragment keeps its identity across reloads. */
export function hashText(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
