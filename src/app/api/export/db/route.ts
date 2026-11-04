import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  tracks,
  trackStems,
  trackMasters,
  trackAlignments,
  workspaces,
  playlists,
  playlistTracks,
  releases,
  releaseTracks,
  releasePolls,
  releasePollOptions,
  savedLyrics,
  stylePresets,
  songArchive,
  trackDnaVotes,
  artistPages,
  coverImages,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

// Child tables carry no user_id of their own; fetch them via their parent ids.
async function byParentIds<T>(ids: string[], query: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 1000) {
    out.push(...(await query(ids.slice(i, i + 1000))));
  }
  return out;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const [
    userTracks,
    userStems,
    userMasters,
    userAlignments,
    userWorkspaces,
    userPlaylists,
    userReleases,
    userPolls,
    userSavedLyrics,
    userStylePresets,
    userSongArchive,
    userDnaVotes,
    userArtistPages,
    userCoverImages,
  ] = await Promise.all([
    db.select().from(tracks).where(eq(tracks.userId, userId)),
    db.select().from(trackStems).where(eq(trackStems.userId, userId)),
    db.select().from(trackMasters).where(eq(trackMasters.userId, userId)),
    db.select().from(trackAlignments).where(eq(trackAlignments.userId, userId)),
    db.select().from(workspaces).where(eq(workspaces.userId, userId)),
    db.select().from(playlists).where(eq(playlists.userId, userId)),
    db.select().from(releases).where(eq(releases.userId, userId)),
    db.select().from(releasePolls).where(eq(releasePolls.userId, userId)),
    db.select().from(savedLyrics).where(eq(savedLyrics.userId, userId)),
    db.select().from(stylePresets).where(eq(stylePresets.userId, userId)),
    db.select().from(songArchive).where(eq(songArchive.userId, userId)),
    db.select().from(trackDnaVotes).where(eq(trackDnaVotes.userId, userId)),
    db.select().from(artistPages).where(eq(artistPages.userId, userId)),
    db.select().from(coverImages).where(eq(coverImages.userId, userId)),
  ]);

  const playlistIds = userPlaylists.map((p) => p.id);
  const releaseIds = userReleases.map((r) => r.id);
  const pollIds = userPolls.map((p) => p.id);

  const [userPlaylistTracks, userReleaseTracks, userPollOptions] = await Promise.all([
    byParentIds(playlistIds, (ids) =>
      db.select().from(playlistTracks).where(inArray(playlistTracks.playlistId, ids)),
    ),
    byParentIds(releaseIds, (ids) =>
      db.select().from(releaseTracks).where(inArray(releaseTracks.releaseId, ids)),
    ),
    byParentIds(pollIds, (ids) =>
      db.select().from(releasePollOptions).where(inArray(releasePollOptions.pollId, ids)),
    ),
  ]);

  // Dates serialize to ISO strings via JSON.stringify. Deliberately excluded:
  // credentials (users.password), global app settings (may hold API keys),
  // API logs, push subscriptions and anonymous poll votes.
  const tables = {
    tracks: userTracks,
    trackStems: userStems,
    trackMasters: userMasters,
    trackAlignments: userAlignments,
    workspaces: userWorkspaces,
    playlists: userPlaylists,
    playlistTracks: userPlaylistTracks,
    releases: userReleases,
    releaseTracks: userReleaseTracks,
    releasePolls: userPolls,
    releasePollOptions: userPollOptions,
    savedLyrics: userSavedLyrics,
    stylePresets: userStylePresets,
    songArchive: userSongArchive,
    trackDnaVotes: userDnaVotes,
    artistPages: userArtistPages,
    coverImages: userCoverImages,
  };

  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 2,
    counts,
    ...tables,
  };

  const now = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="melodiq-backup-${now}.json"`,
    },
  });
}
