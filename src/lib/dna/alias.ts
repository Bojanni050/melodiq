import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { parseArtistAliases } from "@/lib/artist-aliases";

/** '' is the account-wide profile: every finished track counts. */
export const DEFAULT_DNA_ALIAS = "";

/**
 * Normalises the alias a DNA endpoint was asked for.
 *
 * Empty means the default (account-wide) profile. A non-empty value must be one
 * of the user's saved artist names, compared case-insensitively and returned in
 * its stored casing — otherwise a typo would create a profile row that never
 * matches a single track, and the page would show an empty tab forever.
 *
 * Returns null when the value is not a known alias; callers answer 400.
 */
export async function resolveDnaAlias(userId: string, raw: unknown): Promise<string | null> {
  const requested = typeof raw === "string" ? raw.trim() : "";
  if (!requested) return DEFAULT_DNA_ALIAS;

  const [user] = await db
    .select({ artistAliases: users.artistAliases })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const match = parseArtistAliases(user.artistAliases).find(
    (alias) => alias.trim().toLowerCase() === requested.toLowerCase(),
  );
  return match ? match.trim() : null;
}
