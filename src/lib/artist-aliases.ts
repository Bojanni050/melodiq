export const MAX_ARTIST_ALIASES = 5;
const ALIAS_MAX_LENGTH = 255;

// artistAliases is stored as a JSON-encoded array of strings on the user
// row. These helpers keep parsing/serializing/validation in one place.

export function parseArtistAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .slice(0, MAX_ARTIST_ALIASES);
  } catch {
    return [];
  }
}

export function serializeArtistAliases(aliases: string[]): string | null {
  const trimmed = aliases.slice(0, MAX_ARTIST_ALIASES).map((a) => a.trim());
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }
  if (trimmed.length === 0) return null;
  return JSON.stringify(trimmed);
}

export function validateArtistAliases(value: unknown): { ok: true; aliases: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Invalid artistAliases — expected an array" };
  }
  if (value.length > MAX_ARTIST_ALIASES) {
    return { ok: false, error: `Maximum of ${MAX_ARTIST_ALIASES} artist aliases` };
  }
  const aliases: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return { ok: false, error: "Invalid artistAliases — each alias must be a string" };
    }
    if (entry.length > ALIAS_MAX_LENGTH) {
      return { ok: false, error: `Artist alias too long (max ${ALIAS_MAX_LENGTH} characters)` };
    }
    aliases.push(entry);
  }
  return { ok: true, aliases };
}
