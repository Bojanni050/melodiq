/**
 * Backfill script: group historical `tracks` rows into `songs`.
 *
 * Every generation request historically produced 1-N sibling `tracks` rows
 * (version A/B/... for the same song) with no shared foreign key linking
 * them — they only share workspaceId/prompt/lyrics/instrumental and were
 * created within a few seconds of each other. This script clusters those
 * siblings into a single `songs` row and sets `tracks.song_id` accordingly.
 *
 * Safe to re-run: only processes tracks where song_id IS NULL.
 *
 * Run with:
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-songs.ts
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import path from "path";

loadEnvConfig(path.resolve(process.cwd()));

import { db } from "@/db";
import { tracks, songs } from "@/db/schema";
import { asc, eq, inArray, isNull } from "drizzle-orm";

const GROUP_WINDOW_MS = 120_000;
const TITLE_SUFFIX = /\s*\(2\)$/;

type PendingTrack = {
  id: string;
  userId: string;
  workspaceId: string | null;
  title: string | null;
  prompt: string;
  lyrics: string | null;
  lyricsTimestamps: string | null;
  language: string | null;
  translatedLyrics: string | null;
  translatedLanguage: string | null;
  instrumental: boolean;
  createdAt: Date;
};

type Group = {
  key: string;
  firstCreatedAt: number;
  members: PendingTrack[];
};

function groupKey(track: PendingTrack): string {
  return JSON.stringify([
    track.workspaceId,
    track.prompt,
    track.lyrics,
    track.instrumental,
  ]);
}

function stripTitleSuffix(title: string | null): string | null {
  if (!title) return title;
  return title.replace(TITLE_SUFFIX, "").trim() || title;
}

function clusterTracks(userTracks: PendingTrack[]): Group[] {
  const groups: Group[] = [];

  for (const track of userTracks) {
    const key = groupKey(track);
    const createdAtMs = track.createdAt.getTime();

    const match = groups.find(
      (group) =>
        group.key === key && createdAtMs - group.firstCreatedAt <= GROUP_WINDOW_MS
    );

    if (match) {
      match.members.push(track);
    } else {
      groups.push({ key, firstCreatedAt: createdAtMs, members: [track] });
    }
  }

  return groups;
}

async function main() {
  console.log("Fetching tracks without a song_id...");

  const pending = await db
    .select({
      id: tracks.id,
      userId: tracks.userId,
      workspaceId: tracks.workspaceId,
      title: tracks.title,
      prompt: tracks.prompt,
      lyrics: tracks.lyrics,
      lyricsTimestamps: tracks.lyricsTimestamps,
      language: tracks.language,
      translatedLyrics: tracks.translatedLyrics,
      translatedLanguage: tracks.translatedLanguage,
      instrumental: tracks.instrumental,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .where(isNull(tracks.songId))
    .orderBy(asc(tracks.userId), asc(tracks.createdAt));

  console.log(`Found ${pending.length} ungrouped tracks.`);

  if (pending.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const byUser = new Map<string, PendingTrack[]>();
  for (const track of pending) {
    const list = byUser.get(track.userId) ?? [];
    list.push(track);
    byUser.set(track.userId, list);
  }

  let songsCreated = 0;
  let tracksLinked = 0;
  let errors = 0;

  for (const [userId, userTracks] of byUser) {
    const groups = clusterTracks(userTracks);

    for (const group of groups) {
      try {
        const primary = group.members[0];

        const [song] = await db
          .insert(songs)
          .values({
            userId,
            workspaceId: primary.workspaceId,
            title: stripTitleSuffix(primary.title),
            prompt: primary.prompt,
            lyrics: primary.lyrics,
            lyricsTimestamps: primary.lyricsTimestamps,
            language: primary.language,
            translatedLyrics: primary.translatedLyrics,
            translatedLanguage: primary.translatedLanguage,
            instrumental: primary.instrumental,
          })
          .returning({ id: songs.id });

        await db
          .update(tracks)
          .set({ songId: song.id })
          .where(
            inArray(
              tracks.id,
              group.members.map((member) => member.id)
            )
          );

        songsCreated++;
        tracksLinked += group.members.length;
      } catch (err: any) {
        errors++;
        console.error(
          `Failed to backfill group for user ${userId} (${group.members.map((m) => m.id).join(", ")}):`,
          err?.message ?? err
        );
      }
    }
  }

  console.log(
    `\nDone. Created ${songsCreated} songs, linked ${tracksLinked} tracks, ${errors} errors.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
