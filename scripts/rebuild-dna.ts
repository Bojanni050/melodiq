/**
 * Rebuild the stored Melody DNA profile from the current catalogue.
 *
 * Why this exists: the profile is a snapshot. Re-measuring audio (see
 * backfill-tempo.ts) or importing tracks does not change the stored traits until
 * something recomputes them, and until now the only trigger was the first page
 * visit or the rate-limited API route. After a repair of the underlying data you
 * want to run it deliberately, right away, and see what came out.
 *
 * Run with:
 *   npx tsx scripts/rebuild-dna.ts                    # every user with finished tracks
 *   npx tsx scripts/rebuild-dna.ts --user you@mail.com
 *
 * Requires DATABASE_URL (env, .env.local, or the container's env). See
 * scripts/env.ts for why that lives in its own module.
 */

import "./env";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { recomputeDnaProfile } from "@/lib/dna/repository";
import type { DnaTrait } from "@/lib/dna/types";

function parseArgs(argv: string[]) {
  const options = { user: null as string | null };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--user") options.user = argv[++i] ?? null;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npx tsx scripts/rebuild-dna.ts [--user <email|id>]");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return options;
}

/** One line per trait, so the numbers can be compared with the DNA page. */
function describeTrait(trait: DnaTrait): string {
  const confidence = `${Math.round(trait.confidence * 100)}%`;
  return `    ${trait.key.padEnd(16)} ${trait.display.padEnd(28)} ${confidence.padStart(4)}  (${trait.sourceCount} tracks)`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const targets = options.user
    ? await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(or(eq(users.email, options.user), eq(users.id, options.user)))
        .limit(1)
    : await db.select({ id: users.id, email: users.email }).from(users);

  if (targets.length === 0) {
    console.error(options.user ? `No user found for "${options.user}"` : "No users in this database.");
    process.exitCode = 1;
    return;
  }

  for (const target of targets) {
    const result = await recomputeDnaProfile(target.id);
    console.log(`\n${target.email ?? target.id}: ${result.profile.sourceCount} tracks → ${result.built.traits.length} traits`);
    console.log(`  ${result.profile.name}`);
    for (const trait of result.built.traits) console.log(describeTrait(trait));
  }

  console.log("\nDone. The DNA page reads this snapshot.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
