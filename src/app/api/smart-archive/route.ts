import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { tracks, trackStems, trackMasters, playlists, playlistTracks, workspaces } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { findDuplicateCandidateGroups, languageLabel } from "@/lib/smart-archive";
import { collectArchiveWarnings, type ArchiveWarning } from "@/lib/archive-guards";

const SNIPPET_LENGTH = 200;

type GuardedTrack = {
  id: string;
  title: string | null;
  promptSnippet: string | null;
  lyricsSnippet: string | null;
  hasCover: boolean;
  // Soft, not a lock: these tracks stay offerable, the confirmation just
  // explains what archiving them would change.
  warnings: ArchiveWarning[];
  duration: number | null;
  status: string;
  releaseStatus: string | null;
  publishDate: string | null;
  playCount: number;
  lyricsTimestamps: string | null;
  instrumental: boolean;
  // What archiving this track would delete (mirrors /api/tracks/[id]/archive):
  // HD/WAV version, all stems, all masters. The original mp3 and Track DNA
  // (trackDna/audioDna/advancedDna) are always preserved.
  hasHd: boolean;
  stemsCount: number;
  mastersCount: number;
  // "up" is the heart (Favoriet). Shown in the listing so a favourite duplicate
  // is obvious before you archive it.
  rating: string | null;
  // User-created playlists this track is in. System playlists are excluded —
  // "Favorieten" is already shown as the heart and "Master Tracks" already
  // surfaces as a warning, so listing them would be noise.
  playlistNames: string[];
  // Fields the right-hand Track Details panel reads. Not shown in the row, and
  // not fetched before the panel existed.
  language: string | null;
  provider: string;
  providerModel: string;
  prompt: string | null;
  createdAt: string | null;
  completedAt: string | null;
  error: string | null;
  artistName: string | null;
  composerName: string | null;
  writerName: string | null;
  // Smart Ordening: where the track currently lives, so the row can show it
  // and the bulk move can skip tracks already in the target workspace.
  workspaceId: string | null;
  workspaceName: string | null;
};

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const groups = await findDuplicateCandidateGroups(userId);
    const allTrackIds = Array.from(new Set(groups.flatMap((group) => group.trackIds)));

    if (allTrackIds.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const [warningEntries, trackRows, stemCounts, masterCounts, playlistRows, workspaceRows] = await Promise.all([
      Promise.all(
        allTrackIds.map(async (trackId) => [trackId, await collectArchiveWarnings(trackId, userId)] as const)
      ),
      db
        .select({
          id: tracks.id,
          title: tracks.title,
          prompt: tracks.prompt,
          lyrics: tracks.lyrics,
          s3KeyCover: tracks.s3KeyCover,
          duration: tracks.duration,
          status: tracks.status,
          releaseStatus: tracks.releaseStatus,
          publishDate: tracks.publishDate,
          playCount: tracks.playCount,
          lyricsTimestamps: tracks.lyricsTimestamps,
          instrumental: tracks.instrumental,
          s3KeyHd: tracks.s3KeyHd,
          rating: tracks.rating,
          // The right-hand Track Details panel needs these; Slim Archive did not
          // fetch them before because the row never showed them.
          language: tracks.language,
          provider: tracks.provider,
          providerModel: tracks.providerModel,
          createdAt: tracks.createdAt,
          completedAt: tracks.completedAt,
          error: tracks.error,
          artistName: tracks.artistName,
          composerName: tracks.composerName,
          writerName: tracks.writerName,
          workspaceId: tracks.workspaceId,
        })
        .from(tracks)
        .where(and(inArray(tracks.id, allTrackIds), eq(tracks.userId, userId))),
      db
        .select({ trackId: trackStems.trackId, count: sql<number>`count(*)::int` })
        .from(trackStems)
        .where(inArray(trackStems.trackId, allTrackIds))
        .groupBy(trackStems.trackId),
      db
        .select({ trackId: trackMasters.trackId, count: sql<number>`count(*)::int` })
        .from(trackMasters)
        .where(inArray(trackMasters.trackId, allTrackIds))
        .groupBy(trackMasters.trackId),
      // Joined through playlists so the userId guard applies: filtering on
      // trackIds alone would leak the name of another user's playlist if a
      // track id ever collided, and it keeps the "is this mine" decision in one
      // place rather than trusting the caller.
      db
        .select({ trackId: playlistTracks.trackId, name: playlists.name })
        .from(playlistTracks)
        .innerJoin(playlists, eq(playlists.id, playlistTracks.playlistId))
        .where(
          and(
            inArray(playlistTracks.trackId, allTrackIds),
            eq(playlists.userId, userId),
            eq(playlists.isSystem, false)
          )
        ),
      db
        .select({ id: workspaces.id, name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.userId, userId)),
    ]);

    const warningById = new Map(warningEntries);
    const trackById = new Map(trackRows.map((row) => [row.id, row]));
    const stemCountById = new Map(stemCounts.map((row) => [row.trackId, row.count]));
    const masterCountById = new Map(masterCounts.map((row) => [row.trackId, row.count]));

    // Group by track so a track in three playlists keeps all three names.
    const playlistNamesById = new Map<string, string[]>();
    for (const row of playlistRows) {
      const names = playlistNamesById.get(row.trackId) ?? [];
      names.push(row.name);
      playlistNamesById.set(row.trackId, names);
    }
    const workspaceNameById = new Map(workspaceRows.map((row) => [row.id, row.name]));

    const payload = groups
      .map((group) => ({
        id: group.id,
        score: group.score,
        matchedOn: group.matchedOn,
        // Display label ("Dutch"), or null when the members disagree. The
        // per-track language is what the warning/hint text uses; this is the
        // group-level chip.
        language: languageLabel(group.language),
        tracks: group.trackIds
          // No filter on warnings: published / Master Track / playlist members
          // are all offered, because archiving them is the user's choice. The
          // confirmation dialog surfaces the reasons instead.
          .map((trackId): GuardedTrack => {
            const track = trackById.get(trackId);
            const warn = warningById.get(trackId);
            return {
              id: trackId,
              title: track?.title ?? null,
              promptSnippet: track?.prompt ? track.prompt.slice(0, SNIPPET_LENGTH) : null,
              lyricsSnippet: track?.lyrics ? track.lyrics.slice(0, SNIPPET_LENGTH) : null,
              hasCover: !!track?.s3KeyCover,
              warnings: warn?.warnings ?? [],
              duration: track?.duration ?? null,
              status: track?.status ?? "pending",
              releaseStatus: track?.releaseStatus ?? null,
              publishDate: track?.publishDate ? track.publishDate.toISOString() : null,
              playCount: track?.playCount ?? 0,
              lyricsTimestamps: track?.lyricsTimestamps ?? null,
              instrumental: track?.instrumental ?? false,
              hasHd: !!track?.s3KeyHd,
              stemsCount: stemCountById.get(trackId) ?? 0,
              mastersCount: masterCountById.get(trackId) ?? 0,
              rating: track?.rating ?? null,
              playlistNames: playlistNamesById.get(trackId) ?? [],
              language: track?.language ?? null,
              provider: track?.provider ?? "",
              providerModel: track?.providerModel ?? "",
              prompt: track?.prompt ?? null,
              createdAt: track?.createdAt?.toISOString() ?? null,
              completedAt: track?.completedAt?.toISOString() ?? null,
              error: track?.error ?? null,
              artistName: track?.artistName ?? null,
              composerName: track?.composerName ?? null,
              writerName: track?.writerName ?? null,
              workspaceId: track?.workspaceId ?? null,
              workspaceName: track?.workspaceId
                ? (workspaceNameById.get(track.workspaceId) ?? null)
                : null,
            };
          }),
      }))
      // A group left with a single track isn't a duplicate pair anymore.
      .filter((group) => group.tracks.length >= 2);

    return NextResponse.json({ groups: payload });
  } catch (error) {
    console.error("[smart-archive] failed to build duplicate candidate groups", error);
    return NextResponse.json({ error: "Failed to load archive candidates" }, { status: 500 });
  }
}
