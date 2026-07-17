/**
 * One-time cleanup: delete `songs` rows that have zero track versions.
 *
 * A bug in moveTracksToWorkspace (fixed) briefly cleared tracks.song_id
 * right after generation, leaving some songs from that window empty.
 * Run scripts/backfill-songs.ts FIRST to re-group any now-orphaned tracks
 * (song_id IS NULL) back into fresh songs, then run this to remove the
 * old now-empty song rows left behind.
 *
 * Only deletes songs with zero tracks — never touches a song that still
 * has any track version attached.
 *
 * Run with:
 *   npx tsx --tsconfig tsconfig.json scripts/cleanup-empty-songs.ts
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import path from "path";

loadEnvConfig(path.resolve(process.cwd()));

import { db } from "@/db";
import { songs, tracks } from "@/db/schema";
import { notInArray, isNotNull } from "drizzle-orm";

async function main() {
  console.log("Finding songs with zero track versions...");

  const songIdsWithTracks = await db
    .selectDistinct({ songId: tracks.songId })
    .from(tracks)
    .where(isNotNull(tracks.songId));

  const idsWithTracks = songIdsWithTracks
    .map((row) => row.songId)
    .filter((id): id is string => Boolean(id));

  const emptySongs = await db
    .select({ id: songs.id, title: songs.title })
    .from(songs)
    .where(idsWithTracks.length > 0 ? notInArray(songs.id, idsWithTracks) : undefined);

  console.log(`Found ${emptySongs.length} empty songs.`);

  if (emptySongs.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  for (const song of emptySongs) {
    console.log(`- deleting "${song.title}" (${song.id})`);
  }

  await db.delete(songs).where(
    notInArray(
      songs.id,
      idsWithTracks.length > 0 ? idsWithTracks : ["00000000-0000-0000-0000-000000000000"]
    )
  );

  console.log(`\nDone. Deleted ${emptySongs.length} empty songs.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
