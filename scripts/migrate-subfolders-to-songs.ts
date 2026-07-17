/**
 * One-time migration: convert nested-workspace "subfolders" into `songs`.
 *
 * A subfolder is a `workspaces` row with `parent_workspace_id` set, holding
 * tracks directly via `tracks.workspace_id`. The subfolder feature is
 * retired in favor of `songs` — this script turns every subfolder into one
 * `songs` row (under its former parent workspace), reassigns its tracks
 * (song_id + workspace_id), then deletes the subfolder row.
 *
 * This intentionally overrides any song_id a track may already have from
 * `backfill-songs.ts`'s heuristic grouping — explicit subfolder placement
 * is authoritative.
 *
 * Idempotent: after a subfolder is processed its row is deleted, so nothing
 * is left to reprocess on a re-run.
 *
 * Run with:
 *   npx tsx --tsconfig tsconfig.json scripts/migrate-subfolders-to-songs.ts
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import path from "path";

loadEnvConfig(path.resolve(process.cwd()));

import { db } from "@/db";
import { songs, tracks, workspaces } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";

async function main() {
  console.log("Fetching nested-workspace subfolders...");

  const subfolders = await db
    .select()
    .from(workspaces)
    .where(isNotNull(workspaces.parentWorkspaceId));

  console.log(`Found ${subfolders.length} subfolders.`);

  if (subfolders.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let songsCreated = 0;
  let tracksReassigned = 0;
  let errors = 0;

  for (const subfolder of subfolders) {
    try {
      const [song] = await db
        .insert(songs)
        .values({
          userId: subfolder.userId,
          workspaceId: subfolder.parentWorkspaceId,
          title: subfolder.name,
          folderGradient: subfolder.folderGradient,
        })
        .returning({ id: songs.id });

      const reassigned = await db
        .update(tracks)
        .set({
          songId: song.id,
          workspaceId: subfolder.parentWorkspaceId,
        })
        .where(eq(tracks.workspaceId, subfolder.id))
        .returning({ id: tracks.id });

      await db.delete(workspaces).where(eq(workspaces.id, subfolder.id));

      songsCreated++;
      tracksReassigned += reassigned.length;
      console.log(
        `- "${subfolder.name}" (${subfolder.id}) -> song ${song.id}, ${reassigned.length} track(s) reassigned`
      );
    } catch (err: any) {
      errors++;
      console.error(`Failed to migrate subfolder ${subfolder.id} ("${subfolder.name}"):`, err?.message ?? err);
    }
  }

  console.log(
    `\nDone. Created ${songsCreated} songs, reassigned ${tracksReassigned} tracks, ${errors} errors.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
