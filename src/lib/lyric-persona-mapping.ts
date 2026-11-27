import type { lyricPersonas } from "@/db/schema";
import { parseStoredPersonaFragments, type LyricPersona } from "@/lib/lyric-personas";

export type PersonaRow = typeof lyricPersonas.$inferSelect;

export function mapPersonaRow(row: PersonaRow): LyricPersona {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    fragments: parseStoredPersonaFragments(row.fragments),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
